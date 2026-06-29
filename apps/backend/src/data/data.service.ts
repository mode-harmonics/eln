import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { CalendarLife } from '../entities/calendar-life.entity';
import { DcrTest } from '../entities/dcr-test.entity';
import { EnergyEfficiency } from '../entities/energy-efficiency.entity';
import { FastCharge } from '../entities/fast-charge.entity';
import { HtCycle } from '../entities/ht-cycle.entity';
import { ProcessData } from '../entities/process-data.entity';
import { StorageSwelling } from '../entities/storage-swelling.entity';
import { Experiment } from '../entities/experiment.entity';
import { ParserRegistry } from './parsers/parser.registry';
import { computeFastChargeTime } from './parsers/fast-charge.parser';
import { GroupsService } from '../groups/groups.service';

/** Maps a parser's tableName to its TypeORM entity class, for queryRunner.manager.save(). */
const TABLE_NAME_TO_ENTITY: Record<string, new () => unknown> = {
  processData: ProcessData,
  calendarLife: CalendarLife,
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
   * single queryRunner transaction — either everything commits or nothing
   * does, so a malformed sheet can't leave partial data behind.
   */
  async uploadWorkbook(buffer: Buffer<ArrayBufferLike>, experimentId: string): Promise<UploadSummary> {
    const workbook = new ExcelJS.Workbook();
    try {
      // @ts-expect-error: ExcelJS typings expect pre-generic Buffer; runtime behavior is identical
      await workbook.xlsx.load(buffer);
    } catch (err) {
      throw new BadRequestException('Could not parse the uploaded file as an Excel workbook.');
    }

    const rowsByTable: Record<string, Record<string, unknown>[]> = {};
    const sheetsSkipped: string[] = [];
    let sheetsProcessed = 0;

    for (const sheet of workbook.worksheets) {
      const parser = this.parserRegistry.resolve(sheet);
      if (!parser) {
        sheetsSkipped.push(sheet.name);
        continue;
      }

      const rows = parser.parse(sheet, experimentId);
      if (rows.length > 0) {
        rowsByTable[parser.tableName] = (rowsByTable[parser.tableName] ?? []).concat(rows);
      }
      sheetsProcessed += 1;
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

  /** GET /data/:type/:expId — returns all rows for the given table + experiment. */
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

  /** PUT /data/:type/:id — update a single data row. */
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

  /** DELETE /data/:type/:id — delete a single data row. */
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
}