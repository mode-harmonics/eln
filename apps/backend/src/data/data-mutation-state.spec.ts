import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataService } from './data.service';
import { Experiment } from '../entities/experiment.entity';

describe('Data mutations respect experiment state', () => {
  let service: DataService;
  let experiment: any;
  let completed: boolean;
  let saved: any[];
  let locks: any[];
  beforeEach(() => {
    experiment = { id: 'exp', projectId: 'project', status: 'Draft', workflowStepName: 'efficiency' };
    completed = false; saved = []; locks = [];
    const rows = [{ id: 'row', experimentId: 'exp', ce: '2', de: '1' }];
    const dataRepo = {
      metadata: { columns: ['id', 'experimentId', 'ce', 'de'].map(propertyName => ({ propertyName })) },
      find: async () => structuredClone(rows), findOne: async () => structuredClone(rows[0]),
      create: (value: any) => value,
      save: async (value: any) => { saved.push(value); return value; },
      remove: async (value: any) => { saved.push(value); },
    };
    const expRepo = { findOne: async (options: any) => { locks.push(options.lock); return experiment; } };
    const source: any = { getRepository: (entity: unknown) => entity === Experiment ? expRepo : dataRepo };
    source.transaction = async (work: any) => work({ getRepository: source.getRepository });
    service = new DataService(source, {} as any, {} as any, {
      assertStepNotCompleted: async () => { if (completed) throw new ForbiddenException(); },
    } as any);
  });

  it('rejects creation in a completed step without saving', async () => {
    completed = true;
    await expect(service.createRow('efficiency', 'exp', { de: '4' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(saved).toEqual([]);
  });
  it.each(['In Review', 'Approved', 'Archived'])('rejects batch edits in %s', async (status) => {
    experiment.status = status;
    await expect(service.batchUpdateRows('efficiency', [{ id: 'row', de: '4' }])).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toEqual([]);
  });
  it('validates every batch id before saving any rows', async () => {
    await expect(service.batchUpdateRows('efficiency', [{ id: 'row', de: '4' }, { id: 'missing', de: '5' }]))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(saved).toEqual([]);
  });
  it('rejects deletion of data from a reviewed experiment', async () => {
    experiment.status = 'Approved';
    await expect(service.deleteRow('efficiency', 'row')).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toEqual([]);
  });
  it('locks a draft experiment and computes a valid batch before saving', async () => {
    await expect(service.batchUpdateRows('efficiency', [{ id: 'row', de: '4' }])).resolves.toBe(1);
    expect(locks).toContainEqual({ mode: 'pessimistic_write' });
    expect(saved[0][0]).toMatchObject({ de: '4', ee: '2.000000' });
  });
});
