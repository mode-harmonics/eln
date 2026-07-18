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

    // ─── Merge processData rows with same cellId ───────────────────────────
    // Formation and grading files produce separate rows per cellId.
    // We merge them so one cellId → one record with combined fields.
    // Also load existing DB rows when mode='merge' (separate upload calls).
    const processRows = rowsByTable['processData'];
    if (processRows && processRows.length > 0) {
      // 1. Fetch ALL ProcessData rows for this project so we can compute cross-step fields (mHold, etc.)
      let allProjectProcessRows: Record<string, unknown>[] = [];
      const exp = await this.dataSource.getRepository(Experiment).findOne({ where: { id: experimentId } });
      if (exp) {
        const projectExps = await this.dataSource.getRepository(Experiment).find({ where: { projectId: exp.projectId } });
        const processExpIds = projectExps.filter(e => (e.metadata as any)?.assayType === 'ProcessData').map(e => e.id);
        if (processExpIds.length > 0) {
          allProjectProcessRows = await this.dataSource.getRepository(ProcessData).find({
            where: { experimentId: In(processExpIds) }
          }) as any;
        }
      }

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
            if (val != null && val !== '' && (existing[key] == null || existing[key] === '')) {
              existing[key] = val;
            }
          }
        }
      }

      if (existingProcessRows.length > 0) {
        (rowsByTable as any)['__deleteProcessData'] = true;
      }

      // Re-compute derived fields for the merged rows using context from ALL project steps
      const parseNum = (v: any) => (v == null || v === '') ? null : Number(v);
      for (const p of merged.values()) {
        const cellId = p['cellId'] as string;
        const ctx = projectDataByCell.get(cellId) || {};

        // Prefer value from current merged row, fallback to other steps in project
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

        p.mIn = mIn !== null ? String(mIn.toFixed(6)) : null;
        p.mLoss = mLoss !== null ? String(mLoss.toFixed(6)) : null;
        p.mHold = mHold !== null ? String(mHold.toFixed(6)) : null;
        p.fq = fq !== null ? String(fq.toFixed(6)) : null;
        p.qdFirst = qdFirst !== null ? String(qdFirst) : null;
        p.fvg = fvg !== null ? String(fvg.toFixed(6)) : null;
        p.ku = ku !== null ? String(ku.toFixed(6)) : null;
        p.qcFirst = qcFirst !== null ? String(qcFirst.toFixed(6)) : null;
        p.ceFirst = ceFirst !== null ? String(ceFirst.toFixed(6)) : null;
      }

      // Deprecated block: calculations are now done in the merge loop above.
      // This is kept empty to avoid git conflicts but the original logic was moved.
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
        // Skip internal markers
        if (tableName.startsWith('__')) continue;
        const EntityClass = TABLE_NAME_TO_ENTITY[tableName];
        if (!EntityClass || rows.length === 0) continue;

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

    return { sheetsProcessed, sheetsSkipped, rowsInsertedByTable };
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

    // Build records from cells that have all four metrics
    const records: { id: string; QD1st: number; GR1: number; FVG: number; KU: number }[] = [];
    for (const r of mergedRows.values()) {
      const qd1st = r.gqd1 != null ? Number(r.gqd1) : null;
      const gr1 = r.gr1 != null ? Number(r.gr1) : null;
      const cellId = r.cellId as string;
      if (qd1st == null || gr1 == null || !cellId) continue;

      // FVG: use stored computed value, or compute from raw fields
      const fvg = r.fvg != null
        ? Number(r.fvg)
        : (r.v1 != null && r.v0 != null && qd1st !== 0 ? (Number(r.v1) - Number(r.v0)) / qd1st : null);

      // KU: use stored computed value, or compute from raw fields
      const ku = r.ku != null
        ? Number(r.ku)
        : (r.fu1 != null && r.fu2 != null ? Number(r.fu1) - Number(r.fu2) : null);

      if (fvg != null && ku != null) {
        records.push({ id: cellId, QD1st: qd1st, GR1: gr1, FVG: fvg, KU: ku });
      }
    }

    if (records.length === 0) {
      throw new BadRequestException(
        '没有找到同时具备 QD1st(首次放电容量/gqd1)、GR1(定容后内阻/gr1)、FVG(化成产气量)、KU(老化电压降) 四项指标的电芯。'
        + ' 请确认已同时上传化成和定容两份原始数据。'
      );
    }

    // Run the algorithm
    const result = pickBatteries({ records });

    // Determine which cell IDs to persist
    let pickedIds = result.assignments.map((a) => a.sampleId);
    if (topN != null && topN > 0 && topN < pickedIds.length) {
      pickedIds = pickedIds.slice(0, topN);
    }

    // Log algorithm results for traceability
    this.logger.log(
      `Auto-pick result for project ${projectId}: groups=${JSON.stringify(result.groups.map(g => ({ group: g.group, ids: g.sampleIds, score: g.score })))} warnings=${JSON.stringify(result.warnings)}`,
    );

    // Replace existing picks
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ projectId } as any);

    const rows = pickedIds.map((cellId) => ({
      id: uuid(),
      projectId,
      cellId,
      pickedBy: 'auto',
    }));
    const saved = (await repo.save(rows as any)) as PickedCell[];

    // Auto-assign groups by prefix
    try {
      const groupMap = await this.groupsService.getGroupMap(pickedIds, projectId);
      const membersRepo = this.dataSource.getRepository(CellGroupMember);
      for (const [cellId, assignment] of Object.entries(groupMap)) {
        if (assignment.groupId) {
          await membersRepo.upsert(
            { id: uuid(), groupId: assignment.groupId, cellIdentifier: cellId },
            ['cellIdentifier'],
          );
        }
      }
    } catch (err) {
      this.logger.warn('Auto group assignment failed (non-fatal):', err as Error);
    }

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
  async manualPickCells(projectId: string, cellIds: string[]): Promise<PickedCell[]> {
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ projectId } as any);

    const rows = cellIds.map((cellId) => ({
      id: uuid(),
      projectId,
      cellId,
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
    const cellIds = picked.map((p) => p.cellId);

    const targets: { entity: new () => any; name: string; assayType: string; label: string }[] = [
      { entity: CalendarLife, name: 'calendarLife', assayType: 'CalendarLife', label: '日历寿命' },
      { entity: StorageSwelling, name: 'storageSwelling', assayType: 'StorageSwelling', label: '存储胀气' },
      { entity: DcrTest, name: 'dcrTest', assayType: 'DcrTest', label: 'DCR测试' },
      { entity: EnergyEfficiency, name: 'energyEfficiency', assayType: 'EnergyEfficiency', label: '能量效率' },
      { entity: FastCharge, name: 'fastCharge', assayType: 'FastCharge', label: '快充时间' },
      { entity: HtCycle, name: 'htCycle', assayType: 'HtCycle', label: '高温循环' },
    ];

    // Fetch all experiments for this project once
    const allExps = await this.dataSource.getRepository(Experiment).find({ where: { projectId } });

    const results: { table: string; experimentId: string; count: number }[] = [];

    for (const { entity, name, assayType, label } of targets) {
      // Find or auto-create the experiment for this assay type
      let exp = allExps.find((e) => (e.metadata as any)?.assayType === assayType) ?? null;
      if (!exp) {
        const today = new Date().toISOString().split('T')[0];
        exp = await this.projectsService.createExperiment(projectId, userId, {
          title: `${label} - ${today}`,
          assayType,
        });
      }

      const repo = this.dataSource.getRepository(entity);

      // Destructive: delete all existing rows for this experiment
      await repo.delete({ experimentId: exp.id } as any);

      // Insert one placeholder row per picked cell
      let count = 0;
      for (const cellId of cellIds) {
        const extra: Record<string, unknown> =
          name === 'calendarLife' ? { dayCount: 0 } :
            name === 'storageSwelling' ? { dayCount: 0 } :
              name === 'htCycle' ? { cycle: 1 } : {};
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

    if (Object.keys(order).length === 0) {
      if (columns.includes('createdAt')) {
        order.createdAt = 'ASC';
      } else {
        order.id = 'ASC';
      }
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
      let ctx: Record<string, unknown> = {};
      const exp = await this.dataSource.getRepository(Experiment).findOne({ where: { id: p.experimentId } });
      if (exp) {
        const projectExps = await this.dataSource.getRepository(Experiment).find({ where: { projectId: exp.projectId } });
        const processExpIds = projectExps.filter(e => (e.metadata as any)?.assayType === 'ProcessData').map(e => e.id);
        if (processExpIds.length > 0) {
          const projectRows = await repo.find({ where: { cellId, experimentId: In(processExpIds) } as any });
          for (const r of projectRows) {
            for (const [k, v] of Object.entries(r)) {
              if (v != null && v !== '') ctx[k] = v;
            }
          }
        }
      }

      const getVal = (key: string) => p[key] != null && p[key] !== '' ? p[key] : ctx[key];
      const n = (v: any) => (v == null || v === '') ? null : Number(v);
      const m0 = n(getVal('m0')), m1 = n(getVal('m1')), m2 = n(getVal('m2')), m4 = n(getVal('m4'));
      const v0 = n(getVal('v0')), v1 = n(getVal('v1'));
      const fq1 = n(getVal('fq1')), fq2 = n(getVal('fq2'));
      const fu1 = n(getVal('fu1')), fu2 = n(getVal('fu2'));
      const gqc1 = n(getVal('gqc1')), gqd1 = n(getVal('gqd1'));

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

  /** Export summary data to Excel */
  async exportSummaryData(experimentId: string): Promise<ExcelJS.Workbook> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) throw new NotFoundException(`Experiment not found.`);

    const metadata = experiment.metadata as Record<string, any> | null;
    const assayType = metadata?.assayType;
    const map: Record<string, string> = { ProcessData: 'process', CalendarLife: 'calendar', StorageSwelling: 'swelling', EnergyEfficiency: 'efficiency', DcrTest: 'dcr', FastCharge: 'fastcharge', HtCycle: 'htcycle' };
    const typeParam = typeof assayType === 'string' ? map[assayType] : undefined;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('汇总数据');

    if (typeParam) {
      const data = await this.findByType(typeParam, experimentId) as Record<string, any>[];
      const headers = getColumnHeaders(typeParam);
      if (data && data.length > 0) {
        // Determine which columns to include (preserve display order from headers map)
        const cols = Object.keys(headers).filter(h => data[0][h] !== undefined);
        sheet.columns = cols.map(c => ({ header: headers[c] || c, key: c, width: 18 }));
        data.forEach(row => sheet.addRow(row));
        // Style header row
        sheet.getRow(1).font = { bold: true };
      } else {
        sheet.addRow(['暂无数据']);
      }
    } else {
      sheet.addRow(['未知实验类型或暂无数据']);
    }
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
}