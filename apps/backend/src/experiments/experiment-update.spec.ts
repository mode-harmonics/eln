import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';

describe('ExperimentsService update transaction', () => {
  let service: ExperimentsService;
  let stored: Experiment | null;
  let histories: VersionHistory[];
  let failHistory: boolean;
  let lockReads: jest.Mock;

  beforeEach(() => {
    stored = {
      id: 'experiment', projectId: 'project', title: 'Original', content: 'Original content',
      status: 'Draft', metadata: { assayType: 'ProcessData' }, versionNo: 3,
      workflowStepName: null, aiAnalysisOutput: null, reviewerId: null,
      reviewComment: null, reviewedAt: null,
      createdBy: 'author', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    };
    histories = [];
    failHistory = false;
    const clone = <T>(value: T): T => structuredClone(value);
    lockReads = jest.fn();
    const experimentRepo = {
      findOne: async () => clone(stored),
      save: async (value: Experiment) => { stored = clone(value); return value; },
    };
    const historyRepo = {
      create: (value: VersionHistory) => value,
      save: async (value: VersionHistory) => {
        if (failHistory) throw new Error('History unavailable');
        histories.push(clone(value));
        return value;
      },
    };
    // Model the database transaction boundary: staged writes publish only on success.
    const dataSource = {
      transaction: async (callback: (manager: any) => Promise<Experiment>) => {
        let staged = clone(stored);
        const stagedHistories = clone(histories);
        const manager = {
          findOne: async (entity: unknown, options: unknown) => {
            lockReads(entity, options);
            return clone(staged);
          },
          create: (_entity: unknown, value: unknown) => value,
          save: async (entity: unknown, value: any) => {
            if (entity === Experiment) staged = clone(value);
            else if (entity === VersionHistory) {
              if (failHistory) throw new Error('History unavailable');
              stagedHistories.push(clone(value));
            } else throw new Error('Unexpected entity');
            return value;
          },
        };
        const result = await callback(manager);
        stored = staged;
        histories = stagedHistories;
        return result;
      },
    };
    service = new ExperimentsService(
      experimentRepo as any, {} as any, {} as any, historyRepo as any,
      {} as any, {} as any, {} as any, { createNotification: jest.fn().mockResolvedValue({}) } as any, {} as any, dataSource as any,
    );
  });

  it('locks the row and commits the edited version with a matching audit snapshot', async () => {
    const result = await service.update('experiment', 'editor', {
      versionNo: 3, title: 'Edited', changeSummary: 'Correct title',
    });

    expect(lockReads).toHaveBeenCalledWith(Experiment, {
      where: { id: 'experiment' }, lock: { mode: 'pessimistic_write' },
    });
    expect(result).toMatchObject({ title: 'Edited', content: 'Original content', versionNo: 4 });
    expect(stored).toEqual(result);
    expect(histories).toHaveLength(1);
    expect(histories[0]).toMatchObject({
      experimentId: 'experiment', versionNumber: 4, updatedBy: 'editor',
      changeSummary: 'Correct title', snapshot: JSON.parse(JSON.stringify(result)),
    });
  });

  it('does not commit edited content when the history write fails', async () => {
    failHistory = true;

    await expect(service.update('experiment', 'editor', { versionNo: 3, title: 'Edited' }))
      .rejects.toThrow('History unavailable');

    expect(stored).toMatchObject({ title: 'Original', versionNo: 3 });
    expect(histories).toEqual([]);
  });

  it.each(['In Review', 'Approved', 'Archived'])('rejects editing a %s experiment', async (status) => {
    stored!.status = status;

    await expect(service.update('experiment', 'editor', { versionNo: 3, title: 'Edited' }))
      .rejects.toBeInstanceOf(ConflictException);

    expect(stored).toMatchObject({ title: 'Original', versionNo: 3, status });
    expect(histories).toEqual([]);
  });

  it('rejects a stale version without writing content or history', async () => {
    await expect(service.update('experiment', 'editor', { versionNo: 2, title: 'Edited' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(stored).toMatchObject({ title: 'Original', versionNo: 3 });
    expect(histories).toEqual([]);
  });

  it('rejects missing experiments without creating history', async () => {
    stored = null;
    await expect(service.update('missing', 'editor', { versionNo: 3 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(histories).toEqual([]);
  });
  it.each([
    ['submit', 'Draft', 'In Review'], ['approve', 'In Review', 'Approved'],
    ['reject', 'In Review', 'Draft'], ['archive', 'Approved', 'Archived'],
  ])('atomically persists %s with its audit snapshot', async (action, from, to) => {
    stored!.status = from;
    const result = await (service as any)[action]('experiment', 'editor', action === 'submit' ? {} : 'review note');
    expect(result).toMatchObject({ status: to, versionNo: 4 });
    expect(histories).toHaveLength(1);
    expect(histories[0].snapshot).toEqual(JSON.parse(JSON.stringify(result)));
    expect(lockReads).toHaveBeenCalledWith(Experiment, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it.each(['submit', 'approve', 'reject', 'archive'])('rolls back %s if its audit write fails', async (action) => {
    const status = action === 'submit' ? 'Draft' : action === 'archive' ? 'Approved' : 'In Review';
    stored!.status = status;
    failHistory = true;
    await expect((service as any)[action]('experiment', 'editor', action === 'submit' ? {} : 'note')).rejects.toThrow('History unavailable');
    expect(stored).toMatchObject({ status, versionNo: 3 });
    expect(histories).toEqual([]);
  });

});
