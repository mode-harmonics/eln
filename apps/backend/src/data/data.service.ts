import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, In } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { CalendarLife } from '../entities/calendar-life.entity';
import { RawStepData } from '../entities/raw-step-data.entity';
import { PickedCell } from '../entities/picked-cell.entity';
import { DcrTest } from '../entities/dcr-test.entity';
import { EnergyEfficiency } from '../entities/energy-efficiency.entity';
import { FastCharge } from '../entities/fast-charge.entity';
import { HtCycle } from '../entities/ht-cycle.entity';
import { ProcessData } from '../entities/process-data.entity';
import { StorageSwelling } from '../entities/storage-swelling.entity';
import { Experiment } from '../entities/experiment.entity';

import { ParserRegistry } from './parsers/parser.registry';
import { CalendarLifeStepParser } from './parsers/calendar-life-step.parser';
import { DcrTestStepParser } from './parsers/dcr-test-step.parser';
import { EnergyEfficiencyStepParser } from './parsers/energy-efficiency-step.parser';
import { FastChargeStepParser } from './parsers/fast-charge-step.parser';
import { ProcessDataStepParser } from './parsers/process-data-step.parser';
import { HtCycleStepParser } from './parsers/ht-cycle-step.parser';
import { computeFastChargeTime } from './parsers/fast-charge.parser';
import { GroupsService } from '../groups/groups.service';
import { CellGroupMember } from '../entities/cell-group-member.entity';
import { ProjectsService } from '../projects/projects.service';
import { pickBatteries } from '../battery-picker/pick-batteries';
import { getColumnHeaders, RAW_STEP_COLUMNS } from './export-columns';
import { WorkflowService } from '../workflow/workflow.service';

/** Maps a parser's tableName to its TypeORM entity class, for queryRunner.manager.save(). */
const TABLE_NAME_TO_ENTITY: Record<string, new () => unknown> = {
  processData: ProcessData,
  calendarLife: CalendarLife,
  RawStepData: RawStepData,
  storageSwelling: StorageSwelling,
  energyEfficiency: EnergyEfficiency,
  dcrTest: DcrTest,
  fastCharge: FastCharge,
  htCycle: HtCycle,
};

/** Maps the GET /data/:type/:expId path segment to a TypeORM entity class. */
const TYPE_PARAM_TO_ENTITY: Record<string, new () => unknown> = {
  process: ProcessData,
  calendar: CalendarLife,
  swelling: StorageSwelling,
  efficiency: EnergyEfficiency,
  dcr: DcrTest,
  fastcharge: FastCharge,
  htcycle: HtCycle,
  raw: RawStepData,
};

export interface UploadSummary {
  sheetsProcessed: number;
  sheetsSkipped: string[];
  rowsInsertedByTable: Record<string, number>;
}

export function parseNum(v: any): number | null {
  return (v == null || v === '') ? null : Number(v);
}

export function computeProcessDataDerivedFields(p: Record<string, any>, ctx: Record<string, any> = {}) {
  const getVal = (key: string) => p[key] != null && p[key] !== '' ? p[key] : ctx[key];
  const m0 = parseNum(getVal('m0')), m1 = parseNum(getVal('m1')), m2 = parseNum(getVal('m2')), m4 = parseNum(getVal('m4'));
  const v0 = parseNum(getVal('v0')), v1 = parseNum(getVal('v1'));
  const fq1 = parseNum(getVal('fq1')), fq2 = parseNum(getVal('fq2'));
  const fu1 = parseNum(getVal('fu1')), fu2 = parseNum(getVal('fu2'));
  const gqc1 = parseNum(getVal('gqc1')), gqd1 = parseNum(getVal('gqd1'));

  const mIn = m1 !== null && m0 !== null ? m1 - m0 : null;
  const mLoss = m1 !== null && m2 !== null ? m1 - m2 : null;
  const mHold = m4 !== null && m0 !== null ? m4 - m0 : null;
  const fq = fq1 !== null && fq2 !== null ? fq1 + fq2 : null;
  const qdFirst = gqd1;
  const fvg = v1 !== null && v0 !== null && qdFirst ? (v1 - v0) / qdFirst : null;
  const ku = fu1 !== null && fu2 !== null ? fu1 - fu2 : null;
  const qcFirst = fq !== null && gqc1 !== null ? fq + gqc1 : null;
  const ceFirst = qdFirst !== null && qcFirst ? (qdFirst / qcFirst) * 100 : null;

  p.mIn = mIn !== null ? mIn.toFixed(6) : null;
  p.mLoss = mLoss !== null ? mLoss.toFixed(6) : null;
  p.mHold = mHold !== null ? mHold.toFixed(6) : null;
  p.fq = fq !== null ? fq.toFixed(6) : null;
  p.qdFirst = qdFirst !== null ? String(qdFirst) : null;
  p.fvg = fvg !== null ? fvg.toFixed(6) : null;
  p.ku = ku !== null ? ku.toFixed(6) : null;
  p.qcFirst = qcFirst !== null ? qcFirst.toFixed(6) : null;
  p.ceFirst = ceFirst !== null ? ceFirst.toFixed(6) : null;
}

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly parserRegistry: ParserRegistry,
    private readonly groupsService: GroupsService,
    private readonly projectsService: ProjectsService,
    private readonly workflowService: WorkflowService,
  ) { }

  /**
   * Retrieves all rows of a specified table (EntityClass) that belong to
   * any experiment in the same project having the given assayType.
   */
  private async getProjectRows<T extends import('typeorm').ObjectLiteral>(
    experimentId: string,
    assayType: string,
    EntityClass: import('typeorm').EntityTarget<T>,
    whereConditions: Record<string, unknown>
  ): Promise<T[]> {
    const exp = await this.dataSource.getRepository(Experiment).findOne({ where: { id: experimentId } });
    if (!exp) return [];

    const projectExps = await this.dataSource.getRepository(Experiment).find({ where: { projectId: exp.projectId } });
    const targetExpIds = projectExps.filter(e => (e.metadata as any)?.assayType === assayType).map(e => e.id);

    if (targetExpIds.length === 0) return [];

    return this.dataSource.getRepository(EntityClass).find({
      where: { experimentId: In(targetExpIds), ...whereConditions } as any
    });
  }

  async getExperiment(id: string): Promise<Experiment | null> {
    return this.dataSource.getRepository(Experiment).findOne({ where: { id } });
  }

  /**
   * Loads the uploaded workbook with ExcelJS, runs every sheet through the
   * ParserRegistry, and bulk-inserts the parsed rows for all 7 tables in a
   * single queryRunner transaction either everything commits or nothing
   * does, so a malformed sheet can't leave partial data behind.
   */
  async uploadWorkbooks(
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
    experimentId: string,
    uploadedBy: string,
    mode?: 'overwrite' | 'merge',
  ): Promise<UploadSummary> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) throw new NotFoundException('Experiment not found');
    const assayType = experiment.metadata?.assayType as string | undefined;

    if (experiment.workflowStepName) {
      await this.workflowService.assertStepNotCompleted(experiment.projectId, experiment.workflowStepName);
    }

    // Step 2a: Duplicate detection — check if any business data exists for this experiment
    const businessRepos = [
      this.dataSource.getRepository(ProcessData),
      this.dataSource.getRepository(CalendarLife),
      this.dataSource.getRepository(DcrTest),
      this.dataSource.getRepository(EnergyEfficiency),
      this.dataSource.getRepository(FastCharge),
      this.dataSource.getRepository(HtCycle),
      this.dataSource.getRepository(StorageSwelling),
    ];
    let existingTotal = 0;
    for (const repo of businessRepos) {
      existingTotal += await repo.count({ where: { experimentId } as any });
    }
    if (existingTotal > 0 && !mode) {
      throw new ConflictException(
        JSON.stringify({
          conflict: true,
          existingCount: existingTotal,
          message: `此实验已有 ${existingTotal} 行数据。覆盖还是合并？`,
        }),
      );
    }
    if (mode === 'overwrite' && existingTotal > 0) {
      // Clean up physical file attachments on disk
      const attachments = await this.dataSource.getRepository(Attachment).find({
        where: { experimentId },
      });
      for (const att of attachments) {
        if (fs.existsSync(att.filePath)) {
          try {
            fs.unlinkSync(att.filePath);
          } catch { /* file may already be gone — ignore */ }
        }
      }
      await this.dataSource.getRepository(Attachment).delete({ experimentId });

      // Delete old business data & raw steps
      const deleteFrom = (repo: any) => repo.delete({ experimentId });
      await Promise.all([
        deleteFrom(this.dataSource.getRepository(ProcessData)),
        deleteFrom(this.dataSource.getRepository(CalendarLife)),
        deleteFrom(this.dataSource.getRepository(DcrTest)),
        deleteFrom(this.dataSource.getRepository(EnergyEfficiency)),
        deleteFrom(this.dataSource.getRepository(FastCharge)),
        deleteFrom(this.dataSource.getRepository(HtCycle)),
        deleteFrom(this.dataSource.getRepository(StorageSwelling)),
        deleteFrom(this.dataSource.getRepository(RawStepData)),
      ]);
    }

    const rowsByTable: Record<string, Record<string, unknown>[]> = {};
    const sheetsSkipped: string[] = [];
    let sheetsProcessed = 0;
    const rawSteps: Partial<RawStepData>[] = [];
    const attachmentsToSave: Attachment[] = [];

    for (const { buffer, originalname, mimetype } of files) {
      const attachmentId = uuid();
      const ext = path.extname(originalname) || '.xlsx';
      const storedName = `${attachmentId}${ext}`;
      const dir = path.resolve('uploads', experimentId);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, storedName);
      fs.writeFileSync(filePath, buffer);

      const attachment = new Attachment();
      attachment.id = attachmentId;
      attachment.experimentId = experimentId;
      attachment.fileName = originalname;
      attachment.filePath = filePath;
      attachment.fileSize = buffer.length;
      attachment.mimeType = mimetype;
      attachment.uploadedBy = uploadedBy;
      attachmentsToSave.push(attachment);

      const workbook = new ExcelJS.Workbook();
      try {
        // @ts-expect-error: ExcelJS typings expect pre-generic Buffer; runtime behavior is identical
        await workbook.xlsx.load(buffer);
      } catch (err) {
        throw new BadRequestException('Could not parse the uploaded file as an Excel workbook.');
      }

      for (const sheet of workbook.worksheets) {
        const parser = this.parserRegistry.resolve(sheet, assayType);
        if (!parser) {
          sheetsSkipped.push(sheet.name);
          continue;
        }

        const rows = parser.parse(sheet, experimentId, originalname, attachmentId);
        if (rows.length > 0) {
          rowsByTable[parser.tableName] = (rowsByTable[parser.tableName] ?? []).concat(rows);
        }

        // Collect raw step data from any step parser
        if (parser instanceof CalendarLifeStepParser || parser instanceof DcrTestStepParser || parser instanceof EnergyEfficiencyStepParser || parser instanceof FastChargeStepParser || parser instanceof ProcessDataStepParser || parser instanceof HtCycleStepParser) {
          rawSteps.push(...parser.getRawSteps());
        }

        sheetsProcessed += 1;
      }
    }

    // Queue raw steps for save
    if (rawSteps.length > 0) {
      rowsByTable['RawStepData'] = (rowsByTable['RawStepData'] ?? []).concat(rawSteps);
    }

    // ─── Filter rows by picked cells ────────────────────────────────────
    // If the experiment's project has picked cells with matching testType,
    // discard any rows whose cellId/cellName isn't in the picked list.
    if (assayType) {
      const pickedCells = await this.dataSource.getRepository(PickedCell).find({
        where: { projectId: experiment.projectId, testType: assayType },
      });
      if (pickedCells.length > 0) {
        const allowedCellIds = new Set(pickedCells.map((pc) => pc.cellId));
        const businessTableNames = ['processData', 'calendarLife', 'storageSwelling', 'energyEfficiency', 'dcrTest', 'fastCharge', 'htCycle'];
        for (const tableName of businessTableNames) {
          const rows = rowsByTable[tableName];
          if (!rows || rows.length === 0) continue;
          const cellField = tableName === 'processData' ? 'cellId' : 'cellName';
          const before = rows.length;
          rowsByTable[tableName] = rows.filter((r) => {
            const val = r[cellField];
            return val != null && allowedCellIds.has(String(val));
          });
          if (rowsByTable[tableName].length < before) {
            this.logger.log(`Picked-cell filter removed ${before - rowsByTable[tableName].length} rows from ${tableName}`);
          }
        }
      }
    }

    // ─── Merge processData rows with same cellId ───────────────────────────
    // Formation and grading files produce separate rows per cellId.
    // We merge them so one cellId → one record with combined fields.
    // Also load existing DB rows when mode='merge' (separate upload calls).
    const processRows = rowsByTable['processData'];
    if (processRows && processRows.length > 0) {
      // 1. Fetch ALL ProcessData rows for this project so we can compute cross-step fields (mHold, etc.)
      const allProjectProcessRows = await this.getProjectRows(experimentId, 'ProcessData', ProcessData, {}) as any[];

      // Build a map of aggregated project rows to help with derived calculation
      const projectDataByCell = new Map<string, Record<string, unknown>>();
      for (const row of allProjectProcessRows) {
        const cellId = row['cellId'] as string;
        if (!cellId) continue;
        const existing = projectDataByCell.get(cellId) || {};
        for (const [key, val] of Object.entries(row)) {
          if (val != null && val !== '') existing[key] = val;
        }
        projectDataByCell.set(cellId, existing);
      }

      // 2. Load existing DB rows for the CURRENT experiment (for merge within this step)
      const existingProcessRows = mode === 'merge'
        ? await this.dataSource.getRepository(ProcessData).find({ where: { experimentId } }) as any[]
        : [];

      const allRows = [...existingProcessRows, ...processRows];

      const merged = new Map<string, Record<string, unknown>>();
      for (const row of allRows) {
        const cellId = row['cellId'] as string;
        if (!cellId) continue;
        const existing = merged.get(cellId);
        if (!existing) {
          merged.set(cellId, { ...row });
        } else {
          // Merge non-null values from the new row into the existing one
          for (const [key, val] of Object.entries(row)) {
            if (val != null && val !== '') {
              existing[key] = val;
            }
          }
        }
      }

      if (existingProcessRows.length > 0) {
        (rowsByTable as any)['__deleteProcessData'] = true;
      }

      // Re-compute derived fields for the merged rows using context from ALL project steps
      for (const p of merged.values()) {
        const cellId = p['cellId'] as string;
        const ctx = projectDataByCell.get(cellId) || {};

        // Copy missing fields from previous steps to current row for persistence
        for (const [key, val] of Object.entries(ctx)) {
          if (!['id', 'experimentId', 'createdAt', 'attachmentId', 'cellId'].includes(key)) {
            if (p[key] == null || p[key] === '') {
              p[key] = val;
            }
          }
        }

        computeProcessDataDerivedFields(p, ctx);
      }

      rowsByTable['processData'] = Array.from(merged.values());
    }

    const rowsInsertedByTable: Record<string, number> = {};

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Save all attachments inside transaction
      for (const att of attachmentsToSave) {
        await queryRunner.manager.save(att);
      }

      // Delete existing processData rows before saving merged result (merge mode)
      if ((rowsByTable as any)['__deleteProcessData']) {
        await queryRunner.manager.delete(ProcessData, { experimentId });
      }

      for (const [tableName, rows] of Object.entries(rowsByTable)) {
        if (tableName.startsWith('__')) continue;
        const EntityClass = TABLE_NAME_TO_ENTITY[tableName];
        if (!EntityClass || rows.length === 0) continue;

        if (mode === 'merge' && tableName !== 'processData' && tableName !== 'RawStepData') {
          const existingRows = await queryRunner.manager.find(EntityClass, { where: { experimentId } }) as any[];
          for (const newRow of rows) {
            const exist = existingRows.find(r => 
              r.cellName === newRow.cellName &&
              (newRow.dayCount === undefined || r.dayCount === newRow.dayCount) &&
              (newRow.days === undefined || r.days === newRow.days) &&
              (newRow.cycle === undefined || r.cycle === newRow.cycle)
            );
            if (exist) {
              newRow.id = exist.id;
              for (const [k, v] of Object.entries(exist)) {
                if (v != null && v !== '' && (newRow[k] == null || newRow[k] === '')) {
                  newRow[k] = v;
                }
              }
            }
          }
        }

        await queryRunner.manager.save(EntityClass, rows);
        rowsInsertedByTable[tableName] = rows.length;
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // Clean up written files on disk on rollback
      for (const att of attachmentsToSave) {
        if (fs.existsSync(att.filePath)) {
          try {
            fs.unlinkSync(att.filePath);
          } catch { /* file may already be gone — ignore */ }
        }
      }
      this.logger.error('Excel upload transaction failed, rolled back.', err as Error);
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.recomputeExperimentDerivedFields(experimentId);

    return { sheetsProcessed, sheetsSkipped, rowsInsertedByTable };
  }

  /**
   * Re-calculates derived metrics across all accumulated business rows for an experiment.
   * Ensures that multi-batch uploads retain baseline-dependent calculations
   * (e.g. HtCycle retention relative to cycle 1, CalendarLife growth relative to day 0, etc.)
   */
  private async recomputeExperimentDerivedFields(experimentId: string): Promise<void> {
    const num = (v: any) => (v == null || v === '') ? null : Number(v);

    // 1. HtCycle
    const htRepo = this.dataSource.getRepository(HtCycle);
    const htRows = await htRepo.find({ where: { experimentId } });
    if (htRows.length > 0) {
      const byCell = new Map<string, HtCycle[]>();
      for (const r of htRows) {
        const list = byCell.get(r.cellName) || [];
        list.push(r);
        byCell.set(r.cellName, list);
      }
      let htModified = false;
      for (const [, rows] of byCell) {
        const baseCycle = rows.find(r => r.cycle === 1 || (r as any).cycleNo === 1);
        if (baseCycle && baseCycle.dischargeCapacity) {
          const baseCap = num(baseCycle.dischargeCapacity);
          if (baseCap && baseCap !== 0) {
            for (const r of rows) {
              const cap = num(r.dischargeCapacity);
              const expectedRetention = cap != null ? ((cap / baseCap) * 100).toFixed(6) : null;
              if (r.capacityRetention !== expectedRetention) {
                r.capacityRetention = expectedRetention;
                htModified = true;
              }
            }
          }
        }
      }
      if (htModified) await htRepo.save(htRows);
    }

    // 2. CalendarLife
    const calRepo = this.dataSource.getRepository(CalendarLife);
    const calRows = await calRepo.find({ where: { experimentId } });
    if (calRows.length > 0) {
      const byCell = new Map<string, CalendarLife[]>();
      for (const r of calRows) {
        const list = byCell.get(r.cellName) || [];
        list.push(r);
        byCell.set(r.cellName, list);
      }
      let calModified = false;
      for (const [, rows] of byCell) {
        const day0 = rows.find(r => r.dayCount === 0);
        if (day0) {
          const q0 = num(day0.q ?? day0.dq);
          const ddcr0 = num(day0.ddcr);
          const cdcr0 = num(day0.cdcr);
          const u0 = num(day0.u);
          const r0 = num(day0.r);

          for (const r of rows) {
            if (r.dayCount === 0) {
              if (q0 != null && r.qRetention !== '100.000000') { r.qRetention = '100.000000'; calModified = true; }
              if (q0 != null && r.qRecovery !== '100.000000') { r.qRecovery = '100.000000'; calModified = true; }
              if (r.ddcrGrowth !== '0.000000') { r.ddcrGrowth = '0.000000'; calModified = true; }
              if (r.cdcrGrowth !== '0.000000') { r.cdcrGrowth = '0.000000'; calModified = true; }
            } else {
              const dq = num(r.dq);
              if (dq != null && q0) {
                const expRet = ((dq / q0) * 100).toFixed(6);
                if (r.qRetention !== expRet) { r.qRetention = expRet; calModified = true; }
              }
              const ddcr = num(r.ddcr);
              if (ddcr != null && ddcr0) {
                const expDdcrG = ((ddcr / ddcr0 - 1) * 100).toFixed(6);
                if (r.ddcrGrowth !== expDdcrG) { r.ddcrGrowth = expDdcrG; calModified = true; }
              }
              const cdcr = num(r.cdcr);
              if (cdcr != null && cdcr0) {
                const expCdcrG = ((cdcr / cdcr0 - 1) * 100).toFixed(6);
                if (r.cdcrGrowth !== expCdcrG) { r.cdcrGrowth = expCdcrG; calModified = true; }
              }
              const u = num(r.u);
              if (u != null && u0) {
                const expUG = ((u / u0 - 1) * 100).toFixed(6);
                if (r.uGrowth !== expUG) { r.uGrowth = expUG; calModified = true; }
              }
              const rv = num(r.r);
              if (rv != null && r0) {
                const expRG = ((rv / r0 - 1) * 100).toFixed(6);
                if (r.rGrowth !== expRG) { r.rGrowth = expRG; calModified = true; }
              }
            }
          }
        }
      }
      if (calModified) await calRepo.save(calRows);
    }

    // 3. StorageSwelling
    const swellRepo = this.dataSource.getRepository(StorageSwelling);
    const swellRows = await swellRepo.find({ where: { experimentId } });
    if (swellRows.length > 0) {
      const byCell = new Map<string, StorageSwelling[]>();
      for (const r of swellRows) {
        const list = byCell.get(r.cellName) || [];
        list.push(r);
        byCell.set(r.cellName, list);
      }
      let swellModified = false;
      for (const [, rows] of byCell) {
        const day0 = rows.find(r => r.dayCount === 0);
        if (day0) {
          const v0 = num(day0.v);
          for (const r of rows) {
            const vNd = num(r.v);
            const qd1st = num(r.qd1st);
            if (r.dayCount === 0) {
              if (r.vg !== '0.000000') { r.vg = '0.000000'; swellModified = true; }
            } else if (vNd != null && v0 != null && qd1st != null && qd1st !== 0) {
              const expVg = ((vNd - v0) / qd1st).toFixed(6);
              if (r.vg !== expVg) { r.vg = expVg; swellModified = true; }
            }
          }
        }
      }
      if (swellModified) await swellRepo.save(swellRows);
    }
  }

  /** Return raw step rows for a given experiment, optionally filtered by dataSource ('formation' | 'grading'). */
  async findRawSteps(experimentId: string, source?: string): Promise<any[]> {
    const where: any = { experimentId };
    if (source && (source === 'formation' || source === 'grading')) {
      where.dataSource = source;
    }
    return this.dataSource.getRepository(RawStepData).find({
      where,
      order: { stepSeqNo: 'ASC' },
    });
  }

  /**
   * Auto-pick cells for a project using the battery selection algorithm.
   * 1. Resolve the project's ProcessData experiment
   * 2. Build input records from process data (QD1st=gqd1, GR1=gr1, FVG=fvg, KU=ku)
   * 3. Run selectBatteries() — z-score outlier removal + global normalization
   *    + sequential combinatorial enumeration
   * 4. Persist the assigned cells as PickedCell rows
   * 5. Auto-assign groups by prefix matching
   */
  async autoPickCells(projectId: string, topN?: number): Promise<PickedCell[]> {
    const TEST_ALLOCATION = [
      { testType: 'CalendarLife', count: 3 },
      { testType: 'StorageSwelling', count: 3 },
      { testType: 'EnergyEfficiency', count: 3 },
      { testType: 'DcrTest', count: 2 },
      { testType: 'FastCharge', count: 3 },
      { testType: 'HtCycle', count: 3 },
    ];

    const exps = await this.dataSource.getRepository(Experiment).find({ where: { projectId } });
    const processExpIds = exps.filter((e) => (e.metadata as any)?.assayType === 'ProcessData').map(e => e.id);

    if (processExpIds.length === 0) {
      throw new BadRequestException('No ProcessData experiment found for this project. Please import process data first.');
    }

    const processRows = await this.dataSource.getRepository(ProcessData).find({
      where: { experimentId: In(processExpIds) },
    });

    // Merge them by cellId
    const mergedRows = new Map<string, Record<string, unknown>>();
    for (const row of processRows) {
      if (!row.cellId) continue;
      const existing = mergedRows.get(row.cellId) || {};
      for (const [k, v] of Object.entries(row)) {
        if (v != null && v !== '') existing[k] = v;
      }
      mergedRows.set(row.cellId, existing);
    }

    // Build records from cells that have cellId
    const records: { id: string; QD1st: number; fqTotal: number }[] = [];
    for (const r of mergedRows.values()) {
      const cellId = r.cellId as string;
      if (!cellId) continue;
      
      const qd1st = r.gqd1 != null ? Number(r.gqd1) : null;
      const fq1 = r.fq1 != null ? Number(r.fq1) : 0;
      const fq2 = r.fq2 != null ? Number(r.fq2) : 0;
      
      records.push({ id: cellId, QD1st: qd1st ?? -999999, fqTotal: fq1 + fq2 });
    }

    if (records.length === 0) {
      throw new BadRequestException('没有找到可用的电芯数据。');
    }

    // Sort: primary by QD1st (desc), secondary by fqTotal (desc)
    records.sort((a, b) => {
      if (a.QD1st !== b.QD1st) return b.QD1st - a.QD1st;
      return b.fqTotal - a.fqTotal;
    });

    // Limit to 17 (or available)
    const totalNeeded = TEST_ALLOCATION.reduce((sum, t) => sum + t.count, 0);
    const sortedRecords = records.slice(0, totalNeeded);

    // Allocate test types
    let recordIndex = 0;
    const assignments: { cellId: string, testType: string }[] = [];
    for (const alloc of TEST_ALLOCATION) {
      for (let i = 0; i < alloc.count; i++) {
        if (recordIndex < sortedRecords.length) {
          assignments.push({ cellId: sortedRecords[recordIndex].id, testType: alloc.testType });
          recordIndex++;
        }
      }
    }

    // Log algorithm results for traceability
    this.logger.log(`Auto-pick result for project ${projectId}: assigned ${assignments.length} cells.`);

    // Replace existing picks
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ projectId } as any);

    const rows = assignments.map((a) => ({
      id: uuid(),
      projectId,
      cellId: a.cellId,
      testType: a.testType,
      pickedBy: 'auto',
    }));
    const saved = (await repo.save(rows as any)) as PickedCell[];

    return saved;
  }

  /** Get picked cells for a project */
  async getPickedCells(projectId: string): Promise<PickedCell[]> {
    return this.dataSource.getRepository(PickedCell).find({
      where: { projectId } as any,
      order: { createdAt: 'ASC' },
    });
  }

  /** Manual pick: replace picked cells for a project */
  async manualPickCells(projectId: string, assignments?: { cellId: string; testType: string }[], cellIds?: string[]): Promise<PickedCell[]> {
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ projectId } as any);

    const assignmentsToUse = assignments ?? (cellIds?.map(id => ({ cellId: id, testType: null })) ?? []);

    const rows = assignmentsToUse.map((a) => ({
      id: uuid(),
      projectId,
      cellId: a.cellId,
      testType: a.testType ?? null,
      pickedBy: 'manual',
    }));
    return (await repo.save(rows as any)) as PickedCell[];
  }

  /**
   * Sync picked cells to all 6 non-ProcessData tables.
   * - Auto-creates each target experiment if it doesn't exist yet.
   * - DESTRUCTIVE: deletes all existing rows in each target table for
   *   that experiment, then re-inserts one placeholder per picked cell.
   * Caller must pass userId so experiment auto-creation records the creator.
   */
  async syncCellsToTables(
    projectId: string,
    userId: string,
  ): Promise<{ table: string; experimentId: string; count: number }[]> {
    const picked = await this.getPickedCells(projectId);
    
    // Group cellIds by testType
    const cellsByTest = picked.reduce((m, p) => {
      if (p.testType) {
        (m[p.testType] = m[p.testType] ?? []).push(p.cellId);
      }
      return m;
    }, {} as Record<string, string[]>);

    const targets: { entity: new () => any; name: string; assayType: string; label: string; stepName: string }[] = [
      { entity: CalendarLife, name: 'calendarLife', assayType: 'CalendarLife', label: '日历寿命', stepName: 'calendar_life' },
      { entity: StorageSwelling, name: 'storageSwelling', assayType: 'StorageSwelling', label: '存储胀气', stepName: 'storage_swelling' },
      { entity: DcrTest, name: 'dcrTest', assayType: 'DcrTest', label: 'DCR测试', stepName: 'dcr_test' },
      { entity: EnergyEfficiency, name: 'energyEfficiency', assayType: 'EnergyEfficiency', label: '能量效率', stepName: 'energy_efficiency' },
      { entity: FastCharge, name: 'fastCharge', assayType: 'FastCharge', label: '快充时间', stepName: 'fast_charge' },
      { entity: HtCycle, name: 'htCycle', assayType: 'HtCycle', label: '高温循环', stepName: 'ht_cycle' },
    ];

    // Fetch all experiments for this project once
    const allExps = await this.dataSource.getRepository(Experiment).find({ where: { projectId } });

    const results: { table: string; experimentId: string; count: number }[] = [];

    for (const { entity, name, assayType, label, stepName } of targets) {
      const cellIdsForThis = cellsByTest[assayType] ?? [];
      if (cellIdsForThis.length === 0) continue; // Skip if no cells assigned to this test

      // Find or auto-create the experiment for this assay type
      let exp = allExps.find((e) => (e.metadata as any)?.assayType === assayType || e.workflowStepName === stepName) ?? null;
      if (!exp) {
        const today = new Date().toISOString().split('T')[0];
        exp = await this.projectsService.createExperiment(projectId, userId, {
          title: `${label} - ${today}`,
          assayType,
          workflowStepName: stepName,
        });
        allExps.push(exp);
      } else if (!exp.workflowStepName) {
        // Fix for existing experiments created by older code
        exp.workflowStepName = stepName;
        await this.dataSource.getRepository(Experiment).save(exp);
      }

      const repo = this.dataSource.getRepository(entity);

      // Destructive: delete all existing rows for this experiment
      await repo.delete({ experimentId: exp.id } as any);

      // Insert placeholder rows per picked cell
      let count = 0;
      for (const cellId of cellIdsForThis) {
        if (name === 'calendarLife' || name === 'storageSwelling') {
          const days = [0, 7, 14, 21, 28, 35, 42];
          for (const day of days) {
            await repo.save(
              repo.create({
                id: uuid(),
                experimentId: exp.id,
                cellName: cellId,
                dayCount: day,
              } as any),
            );
            count++;
          }
        } else {
          const extra: Record<string, unknown> = name === 'htCycle' ? { cycle: 1 } : {};
          await repo.save(
            repo.create({
              id: uuid(),
              experimentId: exp.id,
              cellName: cellId,
              ...extra,
            } as any),
          );
          count++;
        }
      }
      results.push({ table: name, experimentId: exp.id, count });
    }

    return results;
  }

  /**
   * POST /data/:type/:expId — create a new row in a business table.
   * Used for manual entry (e.g. StorageSwelling which has no Excel parser).
   */
  async createRow(type: string, experimentId: string, body: Record<string, unknown>): Promise<unknown> {
    const EntityClass = TYPE_PARAM_TO_ENTITY[type];
    if (!EntityClass) {
      throw new BadRequestException(
        `Unknown data type "${type}". Expected one of: ${Object.keys(TYPE_PARAM_TO_ENTITY).join(', ')}.`,
      );
    }

    const repo = this.dataSource.getRepository(EntityClass);
    const allowedFields = repo.metadata.columns
      .map((col) => col.propertyName)
      .filter((col) => !['id', 'experimentId', 'attachmentId', 'createdAt'].includes(col));

    const rowData: Record<string, unknown> = { id: uuid(), experimentId };
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        rowData[key] = value;
      }
    }

    return repo.save(repo.create(rowData as any));
  }

  /** Persist the uploaded file to disk and create an attachment record. */
  async saveAttachment(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    experimentId: string,
    uploadedBy: string,
  ): Promise<Attachment> {
    const id = uuid();
    const ext = path.extname(originalName) || '.xlsx';
    const storedName = `${id}${ext}`;
    const dir = path.resolve('uploads', experimentId);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, buffer);

    const attachment = new Attachment();
    attachment.id = id;
    attachment.experimentId = experimentId;
    attachment.fileName = originalName;
    attachment.filePath = filePath;
    attachment.fileSize = buffer.length;
    attachment.mimeType = mimeType;
    attachment.uploadedBy = uploadedBy;

    return this.dataSource.getRepository(Attachment).save(attachment);
  }

  /** GET /data/:type/:expId returns all rows for the given table + experiment. */
  async findByType(type: string, experimentId: string): Promise<unknown[]> {
    const EntityClass = TYPE_PARAM_TO_ENTITY[type];
    if (!EntityClass) {
      throw new BadRequestException(
        `Unknown data type "${type}". Expected one of: ${Object.keys(TYPE_PARAM_TO_ENTITY).join(', ')}.`,
      );
    }

    const repo = this.dataSource.getRepository(EntityClass);

    // Determine dynamic sort order to maintain row stability
    const columns = repo.metadata.columns.map((c) => c.propertyName);
    const order: Record<string, 'ASC' | 'DESC'> = {};

    if (columns.includes('cellId')) {
      order.cellId = 'ASC';
    } else if (columns.includes('cellName')) {
      order.cellName = 'ASC';
    }

    if (columns.includes('dayCount')) {
      order.dayCount = 'ASC';
    } else if (columns.includes('cycle')) {
      order.cycle = 'ASC';
    }

    if (columns.includes('createdAt')) {
      order.createdAt = 'ASC';
    }
    if (columns.includes('id')) {
      order.id = 'ASC';
    }

    return repo.find({
      where: { experimentId } as Record<string, unknown>,
      order
    });
  }

  /**
   * GET /data/:type/:expId?withGroups=true&projectId=...
   * Returns rows + groupMap so the frontend can colour each cell by group.
   */
  async findByTypeWithGroups(
    type: string,
    experimentId: string,
    projectId: string,
  ): Promise<{ rows: unknown[]; groupMap: Record<string, { groupId: string | null; groupName: string | null; color: string }> }> {
    const rows = await this.findByType(type, experimentId) as Record<string, unknown>[];

    // Collect all cell identifiers from the rows
    const cellIdentifiers: string[] = [];
    for (const row of rows) {
      const ci = (row.cellName as string) ?? (row.cellId as string);
      if (ci) cellIdentifiers.push(ci);
    }

    const groupMap = await this.groupsService.getGroupMap(cellIdentifiers, projectId);
    return { rows, groupMap };
  }

  /** PUT /data/:type/:id update a single data row. */
  async updateRow(type: string, id: string, body: Record<string, unknown>): Promise<unknown> {
    const EntityClass = TYPE_PARAM_TO_ENTITY[type];
    if (!EntityClass) {
      throw new BadRequestException(
        `Unknown data type "${type}". Expected one of: ${Object.keys(TYPE_PARAM_TO_ENTITY).join(', ')}.`,
      );
    }

    const repo = this.dataSource.getRepository(EntityClass);
    const row = await repo.findOne({ where: { id } as Record<string, unknown> });
    if (!row) {
      throw new NotFoundException(`Data row not found (type=${type}, id=${id}).`);
    }

    const experimentId = (row as any).experimentId;
    if (experimentId) {
      const experiment = await this.getExperiment(experimentId);
      if (experiment && experiment.workflowStepName) {
        await this.workflowService.assertStepNotCompleted(experiment.projectId, experiment.workflowStepName);
      }
    }

    // Exclude internal/system fields from being overwritten
    const allowedFields = repo.metadata.columns
      .map((col) => col.propertyName)
      .filter((col) => !['id', 'experimentId', 'createdAt'].includes(col));

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        (row as Record<string, unknown>)[key] = value;
      }
    }

    if (type === 'process') {
      const p = row as any;
      const cellId = p.cellId;

      // Fetch all other ProcessData rows for this cellId in the project to compute derived fields
      const ctx: Record<string, unknown> = {};
      const projectRows = await this.getProjectRows(p.experimentId, 'ProcessData', ProcessData, { cellId });
      for (const r of projectRows) {
        for (const [k, v] of Object.entries(r)) {
          if (v != null && v !== '') ctx[k] = v;
        }
      }

      computeProcessDataDerivedFields(p, ctx);
    }

    if (type === 'fastcharge' || type === 'fastCharge') {
      const fc = row as any;
      const c0 = parseFloat(fc.c0 || '3.0');
      let cumulativeSoc = 0;
      if (fc.steps && Array.isArray(fc.steps)) {
        fc.steps.sort((a: any, b: any) => a.stepNo - b.stepNo);
        fc.steps.forEach((s: any) => {
          const capAh = (s.stepCapacity !== null && s.stepCapacity > 15) ? s.stepCapacity / 1000 : s.stepCapacity;
          s.stepSoc = (capAh !== null && c0 > 0) ? Number((capAh / c0).toFixed(6)) : null;
          cumulativeSoc += s.stepSoc ?? 0;
          s.cumulativeSoc = Number(cumulativeSoc.toFixed(6));
        });
        const finalTime = computeFastChargeTime(c0, fc.steps);
        fc.computedFastChargeTime = finalTime !== null ? finalTime.toFixed(6) : null;
      }
    }

    if (type === 'dcr' || type === 'dcrTest') {
      const p = row as any;
      const n = (v: any) => (v == null || v === '') ? null : Number(v);
      let q0 = n(p.q0);
      
      if (q0 == null && p.experimentId) {
        const processRows = await this.getProjectRows(p.experimentId, 'ProcessData', ProcessData, { cellId: p.cellName }) as any[];
        for (const pr of processRows) {
          if (pr.gqd1 != null) {
            q0 = Number(pr.gqd1);
            break;
          }
        }
      }

      const du0 = n(p.du0), du1 = n(p.du1), di = n(p.di);
      const cu0 = n(p.cu0), cu1 = n(p.cu1), ci = n(p.ci);
      
      const ddcr = (du0 != null && du1 != null && di != null && di !== 0) ? Math.abs(du1 - du0) / Math.abs(di) : null;
      const cdcr = (cu0 != null && cu1 != null && ci != null && ci !== 0) ? Math.abs(cu1 - cu0) / Math.abs(ci) : null;
      
      p.ddcr = ddcr != null ? ddcr.toFixed(6) : null;
      p.cdcr = cdcr != null ? cdcr.toFixed(6) : null;
      p.dRcProduct = (q0 != null && ddcr != null) ? (q0 * ddcr).toFixed(6) : null;
      p.cRcProduct = (q0 != null && cdcr != null) ? (q0 * cdcr).toFixed(6) : null;
    }

    if (type === 'efficiency' || type === 'energyEfficiency') {
      const p = row as any;
      const n = (v: any) => (v == null || v === '') ? null : Number(v);
      const de = n(p.de), ce = n(p.ce);
      
      const ee = (de != null && ce != null && ce !== 0) ? de / ce : null;
      p.ee = ee != null ? ee.toFixed(6) : null;
    }

    if (type === 'calendar' || type === 'calendarLife') {
      const p = row as any;
      if (p.experimentId) {
        const projectRows = await this.getProjectRows(p.experimentId, 'CalendarLife', repo.target as any, { cellName: p.cellName }) as any[];
        if (projectRows.length > 0) {
          
          const idx = projectRows.findIndex(r => (r as any).id === p.id);
          if (idx !== -1) projectRows[idx] = p;
          
          const day0 = projectRows.find(r => (r as any).dayCount === 0);
          if (day0) {
            const n = (v: any) => (v == null || v === '') ? null : Number(v);
            const q0 = n((day0 as any).q);
            const ddcr0 = n((day0 as any).ddcr);
            const cdcr0 = n((day0 as any).cdcr);
            const u0 = n((day0 as any).u);
            const r0 = n((day0 as any).r);

            for (const r of projectRows) {
              const cur = r as any;
              const dqVal = n(cur.dq), qVal = n(cur.q), ddcrVal = n(cur.ddcr), cdcrVal = n(cur.cdcr), uVal = n(cur.u), rVal = n(cur.r);
              
              if (cur.dayCount === 0) {
                cur.qRetention = q0 != null ? '100.000000' : null;
                cur.qRecovery  = q0 != null ? '100.000000' : null;
                cur.ddcrGrowth = '0.000000';
                cur.cdcrGrowth = '0.000000';
                cur.uGrowth    = '0.000000';
                cur.rGrowth    = '0.000000';
              } else {
                cur.qRetention = (dqVal != null && q0) ? ((dqVal / q0) * 100).toFixed(6) : null;
                cur.qRecovery  = (qVal != null && q0)  ? ((qVal / q0) * 100).toFixed(6) : null;
                cur.ddcrGrowth = (ddcrVal != null && ddcr0) ? ((ddcrVal / ddcr0 - 1) * 100).toFixed(6) : null;
                cur.cdcrGrowth = (cdcrVal != null && cdcr0) ? ((cdcrVal / cdcr0 - 1) * 100).toFixed(6) : null;
                cur.uGrowth    = (uVal != null && u0) ? ((uVal / u0 - 1) * 100).toFixed(6) : null;
                cur.rGrowth    = (rVal != null && r0) ? ((rVal / r0 - 1) * 100).toFixed(6) : null;
              }
            }
            await repo.save(projectRows);
            return repo.findOne({ where: { id } as Record<string, unknown> });
          }
        }
      }
    }

    if (type === 'swelling' || type === 'storageSwelling') {
      const p = row as any;
      if (p.experimentId) {
        const projectRows = await this.getProjectRows(p.experimentId, 'StorageSwelling', repo.target as any, { cellName: p.cellName }) as any[];
        if (projectRows.length > 0) {
          
          const idx = projectRows.findIndex(r => (r as any).id === p.id);
          if (idx !== -1) projectRows[idx] = p;
          
          const day0 = projectRows.find(r => (r as any).dayCount === 0);
          if (day0) {
            const n = (v: any) => (v == null || v === '') ? null : Number(v);
            const v0 = n((day0 as any).v);
            
            for (const r of projectRows) {
              const cur = r as any;
              const vNd = n(cur.v);
              const qd1st = n(cur.qd1st);
              
              if (cur.dayCount === 0) {
                cur.vg = '0.000000';
              } else {
                cur.vg = (vNd != null && v0 != null && qd1st != null && qd1st !== 0) ? ((vNd - v0) / qd1st).toFixed(6) : null;
              }
            }
            await repo.save(projectRows);
            return repo.findOne({ where: { id } as Record<string, unknown> });
          }
        }
      }
    }

    if (type === 'htcycle' || type === 'htCycle') {
      const p = row as any;
      if (p.experimentId) {
        const projectRows = await this.getProjectRows(p.experimentId, 'HtCycle', repo.target as any, { cellName: p.cellName }) as any[];
        if (projectRows.length > 0) {
          
          const idx = projectRows.findIndex(r => (r as any).id === p.id);
          if (idx !== -1) projectRows[idx] = p;
          
          const baseCycle = projectRows.find(r => (r as any).cycle === 1 || (r as any).cycleNo === 1);
          if (baseCycle) {
            const n = (v: any) => (v == null || v === '') ? null : Number(v);
            const baseCap = n((baseCycle as any).dischargeCapacity);
            
            for (const r of projectRows) {
              const cur = r as any;
              const cap = n(cur.dischargeCapacity);
              cur.capacityRetention = (cap != null && baseCap != null && baseCap !== 0) ? ((cap / baseCap) * 100).toFixed(6) : null;
            }
            await repo.save(projectRows);
            return repo.findOne({ where: { id } as Record<string, unknown> });
          }
        }
      }
    }

    return repo.save(row);
  }

  /** DELETE /data/:type/:id delete a single data row. */
  async deleteRow(type: string, id: string): Promise<{ success: boolean }> {
    const EntityClass = TYPE_PARAM_TO_ENTITY[type];
    if (!EntityClass) {
      throw new BadRequestException(
        `Unknown data type "${type}". Expected one of: ${Object.keys(TYPE_PARAM_TO_ENTITY).join(', ')}.`,
      );
    }

    const repo = this.dataSource.getRepository(EntityClass);
    const row = await repo.findOne({ where: { id } as Record<string, unknown> });
    if (!row) {
      throw new NotFoundException(`Data row not found (type=${type}, id=${id}).`);
    }

    await repo.remove(row);
    return { success: true };
  }

  /** Export summary data to Excel — returns a Buffer. */
  async exportSummaryBuffer(experimentId: string): Promise<Buffer> {
    const workbook = await this.exportSummaryData(experimentId);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Export raw data to Excel — returns a Buffer. */
  async exportRawBuffer(experimentId: string): Promise<Buffer> {
    const workbook = await this.exportRawData(experimentId);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Export summary data to Excel — header labels + column order match the frontend tables exactly. */
  async exportSummaryData(experimentId: string): Promise<ExcelJS.Workbook> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) throw new NotFoundException(`Experiment not found.`);

    const metadata = experiment.metadata as Record<string, any> | null;
    const assayType = metadata?.assayType;
    const map: Record<string, string> = { ProcessData: 'process', CalendarLife: 'calendar', StorageSwelling: 'swelling', EnergyEfficiency: 'efficiency', DcrTest: 'dcr', FastCharge: 'fastcharge', HtCycle: 'htcycle' };
    const typeParam = typeof assayType === 'string' ? map[assayType] : undefined;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('汇总数据');

    if (!typeParam) {
      sheet.addRow(['未知实验类型或暂无数据']);
      return workbook;
    }

    const rawData = await this.findByType(typeParam, experimentId) as Record<string, any>[];
    const headers = getColumnHeaders(typeParam);
    const fieldNames = Object.keys(headers); // ordered — same as export-columns.ts

    if (!rawData || rawData.length === 0) {
      sheet.addRow(['暂无数据']);
      return workbook;
    }

    // Build flat rows, extracting only the fields defined in headers (in order)
    const flatRows: Record<string, any>[] = [];

    if (typeParam === 'fastcharge') {
      // Flatten FastCharge steps like the frontend does
      for (const d of rawData) {
        const steps: any[] = d.steps ?? [];
        if (steps.length === 0) {
          flatRows.push({ cellName: d.cellName, c0: d.c0 });
        } else {
          for (const step of steps) {
            const flat: Record<string, any> = {
              cellName: d.cellName,
              c0: d.c0,
              stepNo: step.stepNo,
              cutOffVoltage: step.cutOffVoltage,
              current: step.current,
              rate: step.rate,
              stepCapacity: step.stepCapacity,
              stepSoc: step.stepSoc,
              cumulativeSoc: step.cumulativeSoc,
              stepTime: step.stepTime,
              providedFastChargeTime: d.providedFastChargeTime,
              computedFastChargeTime: d.computedFastChargeTime,
            };
            flatRows.push(flat);
          }
        }
      }
    } else {
      for (const row of rawData) {
        const flat: Record<string, any> = {};
        for (const f of fieldNames) {
          flat[f] = row[f] ?? null;
        }
        flatRows.push(flat);
      }
    }

    // Set columns (only fields that exist in headers map, preserving order)
    sheet.columns = fieldNames.map(f => ({ header: headers[f], key: f, width: 18 }));
    flatRows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    return workbook;
  }

  /** Export raw data to Excel */
  async exportRawData(experimentId: string): Promise<ExcelJS.Workbook> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) throw new NotFoundException(`Experiment not found.`);

    const metadata = experiment.metadata as Record<string, any> | null;
    const assayType = metadata?.assayType;
    const isProcessData = assayType === 'ProcessData';

    const workbook = new ExcelJS.Workbook();

    if (isProcessData) {
      // ProcessData has two raw data sources
      await this.addRawSheet(workbook, '化成原始数据', experimentId, 'formation');
      await this.addRawSheet(workbook, '定容原始数据', experimentId, 'grading');
    } else {
      await this.addRawSheet(workbook, '原始数据', experimentId);
    }

    return workbook;
  }

  /** Helper: add a raw data sheet to the workbook. */
  private async addRawSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    experimentId: string,
    source?: string,
  ): Promise<void> {
    const data = await this.findRawSteps(experimentId, source);
    const sheet = workbook.addWorksheet(sheetName);

    if (data && data.length > 0) {
      const cols = Object.keys(RAW_STEP_COLUMNS).filter(c => data[0][c] !== undefined);
      sheet.columns = cols.map(c => ({ header: RAW_STEP_COLUMNS[c] || c, key: c, width: 15 }));
      data.forEach(row => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true };
    } else {
      sheet.addRow(['暂无原始数据']);
    }
  }

  /**
   * Export ALL business data for a project into one Excel workbook.
   * One sheet per data type, with Chinese headers + section labels for ProcessData.
   * Merges ProcessData by cellId across experiments (same as frontend ProjectDetail).
   * Column order, section labels, and colors exactly match the frontend tables.
   */
  async exportProjectBuffer(projectId: string): Promise<Buffer> {
    const exps = await this.dataSource.getRepository(Experiment).find({ where: { projectId } });
    if (!exps.length) throw new NotFoundException('Project has no experiments.');

    const expIdsByType: Record<string, string[]> = {};
    const ASSAY_TYPE_MAP: Record<string, string> = {
      ProcessData: 'process', CalendarLife: 'calendar', StorageSwelling: 'swelling',
      EnergyEfficiency: 'efficiency', DcrTest: 'dcr', FastCharge: 'fastcharge', HtCycle: 'htcycle',
    };
    for (const exp of exps) {
      const at = (exp.metadata as any)?.assayType as string;
      if (at && ASSAY_TYPE_MAP[at]) {
        if (!expIdsByType[at]) expIdsByType[at] = [];
        expIdsByType[at].push(exp.id);
      }
    }

    // ── ProcessData column config (order & colors match frontend P_COLS/P_HDR) ──
    const PD_FIELDS = [
      'cellId', 'm0', 'm1', 'mIn', 'm2', 'mLoss', 'v0', 'fu0', 'fr0',
      'fq1', 'fq2', 'fq', 'v1', 'fvg', 'fu1', 'fr1', 'fu2', 'fr2',
      'ku', 'm3', 'm4', 'mHold', 'gu0', 'gr0', 'gqc1', 'gqd1', 'gqc2',
      'gu1', 'gr1', 'qcFirst', 'qdFirst', 'ceFirst',
    ];
    // Color groups: amber=yellow(manual), sky=blue(device), emerald=green(computed)
    const PD_COLORS: Record<string, string> = {};
    for (const f of ['m0', 'm1', 'm2', 'm3', 'm4', 'v0', 'v1', 'fu0', 'fr0', 'fu1', 'fr1', 'fu2', 'fr2', 'gu0', 'gr0']) {
      PD_COLORS[f] = 'FFFEF3C7'; // amber-50 — manual input (editable)
    }
    for (const f of ['fq1', 'fq2', 'gqc1', 'gqd1', 'gqc2', 'gu1', 'gr1']) {
      PD_COLORS[f] = 'FFF0F9FF'; // sky-50 — device obtained
    }
    for (const f of ['mIn', 'mLoss', 'mHold', 'fq', 'fvg', 'ku', 'qcFirst', 'qdFirst', 'ceFirst']) {
      PD_COLORS[f] = 'FFECFDF5'; // emerald-50 — computed
    }

    // Section definitions: [label, firstField, lastField] — end is inclusive
    const PD_SECTIONS: { label: string; startField: string; endField: string }[] = [
      { label: '注液工序', startField: 'm0', endField: 'mLoss' },
      { label: '化成前电池体积', startField: 'v0', endField: 'v0' },
      { label: '化成工序', startField: 'fu0', endField: 'ku' },
      { label: '二封', startField: 'm3', endField: 'mHold' },
      { label: '定容工序', startField: 'gu0', endField: 'gr1' },
      { label: '首圈数据', startField: 'qcFirst', endField: 'ceFirst' },
    ];

    // ── Color maps for other tables (matching frontend buildColorMap) ──
    // amber=FFFEF3C7 (manual/editable), emerald=FFECFDF5 (computed/tooltip), sky=FFF0F9FF (device)
    const CAL_COLORS: Record<string, string> = {
      dayCount: 'FFFEF3C7', dq: 'FFFEF3C7', q: 'FFFEF3C7',
      ddcr: 'FFFEF3C7', cdcr: 'FFFEF3C7', u: 'FFFEF3C7', r: 'FFFEF3C7',
      qRetention: 'FFECFDF5', qRecovery: 'FFECFDF5',
      ddcrGrowth: 'FFECFDF5', cdcrGrowth: 'FFECFDF5',
      uGrowth: 'FFECFDF5', rGrowth: 'FFECFDF5',
    };
    const SWELL_COLORS: Record<string, string> = {
      dayCount: 'FFFEF3C7', qd1st: 'FFFEF3C7', v: 'FFFEF3C7',
      vg: 'FFECFDF5',
    };
    const EFF_COLORS: Record<string, string> = {
      de: 'FFFEF3C7', ce: 'FFFEF3C7',
      ee: 'FFECFDF5',
    };
    const DCR_COLORS: Record<string, string> = {
      q0: 'FFFEF3C7', du0: 'FFFEF3C7', du1: 'FFFEF3C7', di: 'FFFEF3C7',
      cu0: 'FFFEF3C7', cu1: 'FFFEF3C7', ci: 'FFFEF3C7',
      ddcr: 'FFECFDF5', cdcr: 'FFECFDF5',
      dRcProduct: 'FFECFDF5', cRcProduct: 'FFECFDF5',
    };
    const FC_COLORS: Record<string, string> = {
      cutOffVoltage: 'FFFEF3C7', current: 'FFFEF3C7', rate: 'FFFEF3C7',
      stepCapacity: 'FFFEF3C7', stepTime: 'FFFEF3C7',
      stepSoc: 'FFECFDF5', cumulativeSoc: 'FFECFDF5',
      computedFastChargeTime: 'FFF0F9FF', // sky — special computed
    };
    const HT_COLORS: Record<string, string> = {
      cycle: 'FFFEF3C7', dischargeCapacity: 'FFFEF3C7',
      capacityRetention: 'FFECFDF5',
    };

    // Map key → color map
    const COLOR_MAPS: Record<string, Record<string, string>> = {
      CalendarLife: CAL_COLORS,
      StorageSwelling: SWELL_COLORS,
      EnergyEfficiency: EFF_COLORS,
      DcrTest: DCR_COLORS,
      FastCharge: FC_COLORS,
      HtCycle: HT_COLORS,
    };

    // ── Other table field orders (match frontend) ──
    const CAL_FIELDS = ['cellName', 'dayCount', 'dq', 'q', 'qRetention', 'qRecovery', 'ddcr', 'ddcrGrowth', 'cdcr', 'cdcrGrowth', 'u', 'uGrowth', 'r', 'rGrowth'];
    const SWELL_FIELDS = ['cellName', 'qd1st', 'dayCount', 'v', 'vg'];
    const EFF_FIELDS = ['cellName', 'de', 'ce', 'ee'];
    const DCR_FIELDS = ['cellName', 'q0', 'du0', 'du1', 'di', 'ddcr', 'cu0', 'cu1', 'ci', 'cdcr', 'dRcProduct', 'cRcProduct'];
    // Frontend: cellName + computedFastChargeTime use rowSpan across steps; FC_COLS = stepNo..stepTime
    const FC_FIELDS = ['cellName', 'c0', 'providedFastChargeTime', 'stepNo', 'cutOffVoltage', 'current', 'rate', 'stepCapacity', 'stepSoc', 'cumulativeSoc', 'stepTime', 'computedFastChargeTime'];
    const HT_FIELDS = ['cellName', 'ironDissolution', 'cycle', 'dischargeCapacity', 'capacityRetention'];

    const sheetDefs: {
      key: string; name: string; fields: string[];
      flattener?: (rows: any[]) => any[];
      sections?: { label: string; startField: string; endField: string }[];
    }[] = [
      {
        key: 'ProcessData', name: '制程数据', fields: PD_FIELDS,
        sections: PD_SECTIONS,
      },
      { key: 'CalendarLife', name: '日历寿命', fields: CAL_FIELDS },
      { key: 'StorageSwelling', name: '存储胀气', fields: SWELL_FIELDS },
      { key: 'EnergyEfficiency', name: '能量效率', fields: EFF_FIELDS },
      { key: 'DcrTest', name: 'DCR测试', fields: DCR_FIELDS },
      { key: 'FastCharge', name: '快充测试', fields: FC_FIELDS },
      { key: 'HtCycle', name: '高温循环', fields: HT_FIELDS },
    ];

    const workbook = new ExcelJS.Workbook();

    for (const def of sheetDefs) {
      const ids = expIdsByType[def.key];
      if (!ids || ids.length === 0) continue;

      const entityMap: Record<string, any> = {
        ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle,
      };
      const EntityClass = entityMap[def.key];

      const repo = this.dataSource.getRepository(EntityClass);
      let rows: Record<string, any>[] = [];
      for (const eid of ids) {
        const batch = await repo.find({ where: { experimentId: eid } as any });
        rows.push(...batch);
      }
      if (rows.length === 0) continue;

      // Merge ProcessData by cellId (dedup across experiments)
      if (def.key === 'ProcessData') {
        const seen = new Map<string, Record<string, any>>();
        for (const row of rows) {
          const key = row.cellId || row.id;
          if (!seen.has(key)) { seen.set(key, { ...row }); }
          else {
            const existing = seen.get(key)!;
            for (const [k, v] of Object.entries(row)) {
              if (v != null && v !== '' && (existing[k] == null || existing[k] === '')) existing[k] = v;
            }
          }
        }
        rows = Array.from(seen.values());
      }

      // Skip per-field filtering for FastCharge — step fields are in JSONB, not on parent
      if (def.key === 'FastCharge') {
        const sheet = workbook.addWorksheet(def.name);
        const headers = getColumnHeaders('fastcharge');
        const fcColors = COLOR_MAPS.FastCharge || {};
        // Use the full field list as-is
        const fCols = def.fields;

        // Header row
        const colRow = sheet.addRow(fCols.map(f => headers[f] || f));
        colRow.font = { bold: true, size: 10 };
        for (let i = 0; i < fCols.length; i++) {
          const cell = colRow.getCell(i + 1);
          const color = fcColors[fCols[i]];
          if (color) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
          }
        }

        // Grouped data rows with cellName/c0/computedTime merged vertically
        let dataStartRow = 2;
        for (const parent of rows as any[]) {
          const steps: any[] = parent.steps ?? [];
          const n = Math.max(steps.length, 1);
          for (let si = 0; si < n; si++) {
            const s = steps[si] || {};
            const vals = fCols.map(f => {
              if (f === 'cellName' || f === 'c0' || f === 'providedFastChargeTime' || f === 'computedFastChargeTime') {
                return si === 0 ? (parent[f] ?? null) : null;
              }
              return s[f] ?? null;
            });
            sheet.addRow(vals);
          }
          if (n > 1) {
            const mergeCols = ['cellName', 'c0', 'providedFastChargeTime', 'computedFastChargeTime'];
            for (const mf of mergeCols) {
              const ci = fCols.indexOf(mf);
              if (ci >= 0) sheet.mergeCells(dataStartRow, ci + 1, dataStartRow + n - 1, ci + 1);
            }
          }
          dataStartRow += n;
        }
        continue;
      }

      // Flatten if needed
      const flatRows = def.flattener ? def.flattener(rows) : rows;
      // Filter fields to only those present in data
      const cols = def.fields ? def.fields.filter(f => flatRows[0]?.[f] !== undefined) : [];
      if (cols.length === 0) continue;

      const sheet = workbook.addWorksheet(def.name);

      const headers = getColumnHeaders(ASSAY_TYPE_MAP[def.key] || '');
      const headerLabels = cols.map(f => headers[f] || f);

      if (def.sections) {
        // ── Row 1: Section header with merged cells ──
        const secRowVals: (string | null)[] = new Array(cols.length).fill(null);
        const merges: { sc: number; ec: number }[] = [];
        for (const sec of def.sections) {
          const sc = cols.indexOf(sec.startField);
          const ec = cols.lastIndexOf(sec.endField);
          if (sc === -1 || ec === -1) continue;
          secRowVals[sc] = sec.label;
          if (ec > sc) merges.push({ sc: sc + 1, ec: ec + 1 });
        }
        const secRow = sheet.addRow(secRowVals);
        secRow.font = { bold: true, size: 10, color: { argb: 'FF6B7280' } };
        secRow.alignment = { horizontal: 'center', vertical: 'middle' };
        for (const m of merges) sheet.mergeCells(1, m.sc, 1, m.ec);
        // Alternating section background
        def.sections.forEach((sec, i) => {
          const sc = cols.indexOf(sec.startField);
          const ec = cols.lastIndexOf(sec.endField);
          if (sc === -1) return;
          const color = i % 2 === 0 ? 'FFF9FAFB' : 'FFF1F5F9';
          for (let c = sc; c <= ec; c++) {
            if (c >= 0 && c < cols.length) {
              secRow.getCell(c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            }
          }
        });

        // ── Row 2: Column headers with background colors ──
        const colorMap = def.key === 'ProcessData' ? PD_COLORS : (COLOR_MAPS[def.key] || {});
        const colRow = sheet.addRow(headerLabels);
        colRow.font = { bold: true, size: 10 };
        for (let i = 0; i < cols.length; i++) {
          const cell = colRow.getCell(i + 1);
          const color = colorMap[cols[i]];
          if (color) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.font = { bold: true, size: 10, color: { argb: cols[i] === 'cellId' || cols[i] === 'cellName' ? 'FF374151' : 'FF1F2937' } };
          }
        }

        // ── Rows 3+: Data ──
        for (const row of flatRows) {
          sheet.addRow(cols.map(f => row[f] ?? null));
        }
      } else {
        // ── Other tables: single header row with colors ──
        const otherColors = COLOR_MAPS[def.key];
        const colRow = sheet.addRow(headerLabels);
        colRow.font = { bold: true, size: 10 };
        for (let i = 0; i < cols.length; i++) {
          const cell = colRow.getCell(i + 1);
          const color = otherColors?.[cols[i]];
          if (color) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
          }
        }
        for (const row of flatRows) {
          sheet.addRow(cols.map(f => row[f] ?? null));
        }
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}