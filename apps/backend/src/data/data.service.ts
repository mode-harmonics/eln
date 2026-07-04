import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
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
import { computeFastChargeTime } from './parsers/fast-charge.parser';
import { GroupsService } from '../groups/groups.service';
import { CellGroupMember } from '../entities/cell-group-member.entity';

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
  async uploadWorkbooks(buffers: Buffer<ArrayBufferLike>[], experimentId: string, mode?: 'overwrite' | 'merge'): Promise<UploadSummary> {
    const experiment = await this.getExperiment(experimentId);
    const assayType = experiment?.metadata?.assayType as string | undefined;

    // Step 2a: Upload constraint — non-ProcessData requires picked cells
    if (assayType && assayType !== 'ProcessData') {
      const pickedCount = await this.dataSource.getRepository(PickedCell).count({
        where: { experimentId },
      });
      if (pickedCount === 0) {
        throw new BadRequestException(
          '必须先挑选电池再上传此类型数据。请在制成的实验中点击「挑选电池」。',
        );
      }
    }

    // Step 2b: Duplicate detection — check if any business data exists for this experiment
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
      // Delete old business data (but keep raw steps)
      const deleteFrom = (repo: any) => repo.delete({ experimentId });
      await Promise.all([
        deleteFrom(this.dataSource.getRepository(ProcessData)),
        deleteFrom(this.dataSource.getRepository(CalendarLife)),
        deleteFrom(this.dataSource.getRepository(DcrTest)),
        deleteFrom(this.dataSource.getRepository(EnergyEfficiency)),
        deleteFrom(this.dataSource.getRepository(FastCharge)),
        deleteFrom(this.dataSource.getRepository(HtCycle)),
        deleteFrom(this.dataSource.getRepository(StorageSwelling)),
      ]);
    }

    const rowsByTable: Record<string, Record<string, unknown>[]> = {};
    const sheetsSkipped: string[] = [];
    let sheetsProcessed = 0;
    const rawSteps: Partial<RawStepData>[] = [];

    for (const buffer of buffers) {
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

        const rows = parser.parse(sheet, experimentId);
        if (rows.length > 0) {
          rowsByTable[parser.tableName] = (rowsByTable[parser.tableName] ?? []).concat(rows);
        }

        // Collect raw step data from any step parser
        if (parser instanceof CalendarLifeStepParser || parser instanceof DcrTestStepParser || parser instanceof EnergyEfficiencyStepParser || parser instanceof FastChargeStepParser || parser instanceof ProcessDataStepParser) {
          rawSteps.push(...parser.getRawSteps());
        }

        sheetsProcessed += 1;
      }
    }

    // Queue raw steps for save
    if (rawSteps.length > 0) {
      rowsByTable['RawStepData'] = (rowsByTable['RawStepData'] ?? []).concat(rawSteps);
    }

    const rowsInsertedByTable: Record<string, number> = {};

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const [tableName, rows] of Object.entries(rowsByTable)) {
        const EntityClass = TABLE_NAME_TO_ENTITY[tableName];
        if (!EntityClass || rows.length === 0) continue;

        await queryRunner.manager.save(EntityClass, rows);
        rowsInsertedByTable[tableName] = rows.length;
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Excel upload transaction failed, rolled back.', err as Error);
      throw err;
    } finally {
      await queryRunner.release();
    }

    return { sheetsProcessed, sheetsSkipped, rowsInsertedByTable };
  }

  /** Return raw step rows for a given experiment. */
  async findRawSteps(experimentId: string): Promise<RawStepData[]> {
    return this.dataSource.getRepository(RawStepData).find({
      where: { experimentId },
      order: { stepSeqNo: 'ASC' },
    });
  }

  /**
   * Auto-pick cells for a ProcessData experiment.
   * 1. Cells with valid fq1+fq2 are sorted by fqTotal descending
   * 2. Insert into picked_cells table
   * 3. Auto-assign groups by prefix matching
   * 4. Update experiment.cellPicked = true
   */
  async autoPickCells(experimentId: string, projectId: string, topN?: number): Promise<PickedCell[]> {
    const processRows = await this.dataSource.getRepository(ProcessData).find({
      where: { experimentId },
    });

    // Filter cells with valid fq = fq1 + fq2
    const withFq = processRows
      .map((r) => ({
        cellId: r.cellId,
        fqTotal: (r.fq1 != null ? Number(r.fq1) : 0) + (r.fq2 != null ? Number(r.fq2) : 0),
      }))
      .filter((r) => r.fqTotal > 0 && r.cellId)
      .sort((a, b) => b.fqTotal - a.fqTotal);

    if (withFq.length === 0) {
      throw new BadRequestException('No cells with valid formation capacity found.');
    }

    const picked = topN != null && topN > 0 ? withFq.slice(0, topN) : withFq;

    // Replace existing picks
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ experimentId });

    const records = picked.map((p) =>
      repo.create({
        id: uuid(),
        experimentId,
        cellId: p.cellId,
        pickedBy: 'auto',
      }),
    );
    const saved = await repo.save(records);

    // Auto-assign groups by prefix
    const cellIds = saved.map((p) => p.cellId);
    try {
      const groupMap = await this.groupsService.getGroupMap(cellIds, projectId);
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

    // Update experiment
    await this.dataSource.getRepository(Experiment).update(experimentId, { cellPicked: true });

    return saved;
  }

  /** Get picked cells for an experiment */
  async getPickedCells(experimentId: string): Promise<PickedCell[]> {
    return this.dataSource.getRepository(PickedCell).find({
      where: { experimentId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Manual pick: replace picked cells for an experiment */
  async manualPickCells(experimentId: string, cellIds: string[]): Promise<PickedCell[]> {
    const repo = this.dataSource.getRepository(PickedCell);
    await repo.delete({ experimentId });

    const records = cellIds.map((cellId) =>
      repo.create({ id: uuid(), experimentId, cellId, pickedBy: 'manual' }),
    );
    const saved = await repo.save(records);

    await this.dataSource.getRepository(Experiment).update(experimentId, { cellPicked: true });

    return saved;
  }

  /** Sync picked cells to 5 target tables (create empty rows) */
  async syncCellsToTables(experimentId: string): Promise<{ table: string; count: number }[]> {
    const picked = await this.getPickedCells(experimentId);
    const cellIds = picked.map((p) => p.cellId);
    const results: { table: string; count: number }[] = [];

    const targets: { entity: new () => any; name: string }[] = [
      { entity: CalendarLife, name: 'calendarLife' },
      { entity: DcrTest, name: 'dcrTest' },
      { entity: EnergyEfficiency, name: 'energyEfficiency' },
      { entity: FastCharge, name: 'fastCharge' },
      { entity: HtCycle, name: 'htCycle' },
    ];

    for (const { entity, name } of targets) {
      const repo = this.dataSource.getRepository(entity);
      let count = 0;
      for (const cellId of cellIds) {
        const existing = await repo.findOne({ where: { experimentId, cellName: cellId } as any });
        if (existing) continue;
        await repo.save(
          repo.create({
            id: uuid(),
            experimentId,
            cellName: cellId,
          } as any),
        );
        count++;
      }
      results.push({ table: name, count });
    }

    return results;
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

  /** GET /data/:type/:expId �?returns all rows for the given table + experiment. */
  async findByType(type: string, experimentId: string): Promise<unknown[]> {
    const EntityClass = TYPE_PARAM_TO_ENTITY[type];
    if (!EntityClass) {
      throw new BadRequestException(
        `Unknown data type "${type}". Expected one of: ${Object.keys(TYPE_PARAM_TO_ENTITY).join(', ')}.`,
      );
    }

    const repo = this.dataSource.getRepository(EntityClass);
    return repo.find({ where: { experimentId } as Record<string, unknown> });
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

  /** PUT /data/:type/:id �?update a single data row. */
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

    // Exclude internal/system fields from being overwritten
    const allowedFields = repo.metadata.columns
      .map((col) => col.propertyName)
      .filter((col) => !['id', 'experimentId', 'createdAt'].includes(col));

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        (row as Record<string, unknown>)[key] = value;
      }
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

  /** DELETE /data/:type/:id �?delete a single data row. */
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

  /** Export summary data to Excel */
  async exportSummaryData(experimentId: string): Promise<ExcelJS.Workbook> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) throw new NotFoundException(`Experiment not found.`);

    const metadata = experiment.metadata as Record<string, any> | null;
    const assayType = metadata?.assayType;
    const map: any = { ProcessData: 'process', CalendarLife: 'calendar', StorageSwelling: 'swelling', EnergyEfficiency: 'efficiency', DcrTest: 'dcr', FastCharge: 'fastcharge', HtCycle: 'htcycle' };
    const typeParam = typeof assayType === 'string' ? map[assayType] : undefined;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Summary');

    if (typeParam) {
      const data = await this.findByType(typeParam, experimentId) as Record<string, any>[];
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'experimentId' && k !== 'createdAt');
        sheet.columns = columns.map(c => ({ header: c, key: c, width: 15 }));
        data.forEach(row => sheet.addRow(row));
      } else {
        sheet.addRow(['No data available']);
      }
    } else {
      sheet.addRow(['Unknown assay type or no data']);
    }
    return workbook;
  }

  /** Export raw data to Excel */
  async exportRawData(experimentId: string): Promise<ExcelJS.Workbook> {
    const data = await this.findRawSteps(experimentId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Raw Data');

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'experimentId');
      sheet.columns = columns.map(c => ({ header: c, key: c, width: 15 }));
      data.forEach(row => sheet.addRow(row));
    } else {
      sheet.addRow(['No raw data available']);
    }
    return workbook;
  }
}