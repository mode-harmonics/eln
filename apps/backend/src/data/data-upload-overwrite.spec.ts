import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { Attachment } from '../entities/attachment.entity';
import { Experiment } from '../entities/experiment.entity';
import { ProcessData } from '../entities/process-data.entity';
import { Project } from '../entities/project.entity';
import { DataService } from './data.service';
import { ParserRegistry } from './parsers/parser.registry';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn(), unlinkSync: jest.fn(),
}));

describe('DataService atomic workbook overwrite', () => {
  const experimentId = 'upload-experiment';
  const oldPath = '/synthetic-existing.xlsx';
  let service: DataService;
  let database: Map<unknown, any[]>;
  let disk: Map<string, Buffer>;
  let events: string[];
  let failSave: boolean;

  it('preflights every summary destination authorization before writing experiments, rows or files', async () => {
    const before = [...database].map(([entity, rows]) => [entity, structuredClone(rows)]);
    const authorizeStep = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new ForbiddenException('Target step denied'));
    await expect((service.importSummaryWorkbook as any)([await workbook()], 'project', 'user', 'overwrite', authorizeStep)).rejects.toThrow(ForbiddenException);
    expect(authorizeStep).toHaveBeenCalledTimes(2);
    expect([...database]).toEqual(before);
    expect([...disk.keys()]).toEqual([oldPath]);
  });

  async function workbook(sheetName = '制程数据', includeData = true) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(sheetName);
    sheet.addRow(sheetName === 'Notes' ? ['Unrecognized'] : ['cellId', 'm1']);
    if (includeData) sheet.addRow(['A-1', 12]);
    return { buffer: Buffer.from(await book.xlsx.writeBuffer()), originalname: 'replacement.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  beforeEach(() => {
    failSave = false;
    events = [];
    disk = new Map([[oldPath, Buffer.from('original source')]]);
    database = new Map<unknown, any[]>([
      [Project, [{ id: 'project' }]],
      [Experiment, [
        { id: experimentId, projectId: 'project', status: 'Draft', metadata: { assayType: 'ProcessData' } },
        { id: 'previous-step', projectId: 'project', metadata: { assayType: 'ProcessData' } },
      ]],
      [Attachment, [{ id: 'original-attachment', experimentId, filePath: oldPath }]],
      [ProcessData, [
        { id: 'original-data', experimentId, cellId: 'A-1', m1: '99.000000', m2: '88.000000' },
        { id: 'previous-data', experimentId: 'previous-step', cellId: 'A-1', m0: '10.000000' },
      ]],
    ]);
    (fs.existsSync as jest.Mock).mockImplementation((name) => disk.has(String(name)));
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.writeFileSync as jest.Mock).mockImplementation((name, contents) => disk.set(String(name), Buffer.from(contents)));
    (fs.unlinkSync as jest.Mock).mockImplementation((name) => {
      events.push(name === oldPath ? 'delete-old-file' : 'delete-new-file');
      disk.delete(String(name));
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, value]) =>
      value && typeof value === 'object' && 'value' in value
        ? (value.value as any[]).includes(row[key]) : row[key] === value);
    const read = (state: Map<unknown, any[]>, entity: unknown, where?: any) =>
      structuredClone((state.get(entity) ?? []).filter((row) => matches(row, where)));
    const remove = (state: Map<unknown, any[]>, entity: unknown, where: any) =>
      state.set(entity, (state.get(entity) ?? []).filter((row) => !matches(row, where)));
    const save = (state: Map<unknown, any[]>, entity: unknown, values: any[]) => {
      const rows = state.get(entity) ?? [];
      for (const value of values) {
        const index = rows.findIndex((row) => row.id === value.id);
        if (index < 0) rows.push(structuredClone(value));
        else rows[index] = structuredClone(value);
      }
      state.set(entity, rows);
    };
    let staged: Map<unknown, any[]>;
    const runner = {
      connect: async () => undefined,
      startTransaction: async () => {
        staged = new Map([...database].map(([entity, rows]) => [entity, structuredClone(rows)]));
      },
      manager: {
        getRepository: (entity: unknown) => ({
          findOne: async ({ where }: any) => read(staged, entity, where)[0] ?? null,
          find: async ({ where }: any) => read(staged, entity, where),
          count: async ({ where }: any) => read(staged, entity, where).length,
          save: async (values: any[]) => save(staged, entity, values),
        }),
        find: async (entity: unknown, options: any) => read(staged, entity, options.where),
        delete: async (entity: unknown, where: any) => remove(staged, entity, where),
        save: async (entityOrRow: any, values?: any[]) => {
          const entity = values ? entityOrRow : entityOrRow.constructor;
          if (entity === ProcessData && failSave) throw new Error('Synthetic insert failure');
          save(staged, entity, values ?? [entityOrRow]);
        },
      },
      commitTransaction: async () => { events.push('commit'); database = staged; },
      rollbackTransaction: async () => { events.push('rollback'); },
      release: async () => undefined,
    };
    const source = {
      transaction: async (work: any) => {
        await runner.startTransaction();
        (runner.manager as any).queryRunner = runner;
        try { const result = await work(runner.manager); await runner.commitTransaction(); return result; }
        catch (error) { await runner.rollbackTransaction(); throw error; }
      },
      getRepository: (entity: unknown) => ({
        count: async ({ where }: any) => read(database, entity, where).length,
        find: async ({ where }: any) => read(database, entity, where),
        findOne: async ({ where }: any) => read(database, entity, where)[0] ?? null,
        delete: async (where: any) => remove(database, entity, where),
        save: async (values: any[]) => save(database, entity, values),
      }),
      createQueryRunner: () => runner,
    };
    service = new DataService(source as any, new ParserRegistry(), {} as any, { assertStepNotCompleted: async () => undefined } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  function expectOriginalPreserved() {
    expect(database.get(ProcessData)?.find((row) => row.id === 'original-data'))
      .toMatchObject({ m1: '99.000000', m2: '88.000000' });
    expect(database.get(Attachment)).toEqual([{ id: 'original-attachment', experimentId, filePath: oldPath }]);
    expect([...disk.keys()]).toEqual([oldPath]);
  }

  it('preserves existing rows and files when a later workbook is malformed', async () => {
    const valid = await workbook();
    await expect(service.uploadWorkbooks([valid, { ...valid, buffer: Buffer.from('not a workbook') }], experimentId, 'user', 'overwrite'))
      .rejects.toBeInstanceOf(BadRequestException);
    expectOriginalPreserved();
  });

  it('rolls back earlier experiments and their new files when a later summary target is locked', async () => {
    database.set(Experiment, [
      { id: experimentId, projectId: 'project', status: 'Draft', workflowStepName: 'energy_efficiency', metadata: { assayType: 'EnergyEfficiency' } },
      { id: 'previous-step', projectId: 'project', status: 'Approved', workflowStepName: 'calendar_life', metadata: { assayType: 'CalendarLife' } },
    ]);
    const book = new ExcelJS.Workbook();
    book.addWorksheet('能效').addRows([['cellName', 'de', 'ce'], ['A-1', 1, 2]]);
    book.addWorksheet('日历').addRows([['cellName', 'q_0d'], ['A-1', 2]]);
    const file = { buffer: Buffer.from(await book.xlsx.writeBuffer()), originalname: 'summary.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

    await expect(service.importSummaryWorkbook([file], 'project', 'user', 'overwrite'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(events).not.toContain('commit');
    expectOriginalPreserved();
  });

  it.each([['Notes', true], ['制程数据', false]] as const)('rejects empty replacement data from %s (data=%s)', async (name, includeData) => {
    await expect(service.uploadWorkbooks([await workbook(name, includeData)], experimentId, 'user', 'overwrite'))
      .rejects.toBeInstanceOf(BadRequestException);
    expectOriginalPreserved();
  });

  it('rolls back deletions and removes staged files when replacement insertion fails', async () => {
    failSave = true;
    await expect(service.uploadWorkbooks([await workbook()], experimentId, 'user', 'overwrite'))
      .rejects.toThrow('Synthetic insert failure');
    expect(events).toContain('rollback');
    expectOriginalPreserved();
  });

  it('cleans a partially written new file without deleting the original on disk errors', async () => {
    (fs.writeFileSync as jest.Mock).mockImplementationOnce((name) => {
      disk.set(String(name), Buffer.from('partial'));
      throw new Error('Synthetic disk failure');
    });
    await expect(service.uploadWorkbooks([await workbook()], experimentId, 'user', 'overwrite'))
      .rejects.toThrow('Synthetic disk failure');
    expect(events).toContain('rollback');
    expectOriginalPreserved();
  });

  it('deletes old source files only after committing a successful replacement', async () => {
    const result = await service.uploadWorkbooks([await workbook()], experimentId, 'user', 'overwrite');
    expect(result.rowsInsertedByTable.processData).toBe(1);
    expect(events.indexOf('commit')).toBeLessThan(events.indexOf('delete-old-file'));
    expect(database.get(ProcessData)?.some((row) => row.id === 'original-data')).toBe(false);
    expect(database.get(Attachment)).toHaveLength(1);
    expect(disk.has(oldPath)).toBe(false);
    expect(disk.size).toBe(1);
    const replacement = database.get(ProcessData)?.find((row) => row.experimentId === experimentId);
    expect(replacement).toMatchObject({ m0: '10.000000', m1: '12', mIn: '2.000000' });
    expect(replacement.m2 == null).toBe(true);
  });
});
