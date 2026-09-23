import { NotFoundException } from '@nestjs/common';
import { DataService } from './data.service';

describe('DataService solution preparation group metadata', () => {
  const experimentId = 'experiment-1';
  let metadata: any[];
  let service: DataService;

  beforeEach(() => {
    metadata = [];
    const solutionRepository = {
      find: jest.fn(async () => [
        { experimentId, groupName: 'A' },
        { experimentId, groupName: 'A' },
        { experimentId, groupName: 'B' },
      ]),
      exist: jest.fn(async ({ where }: any) => where.experimentId === experimentId && ['A', 'B'].includes(where.groupName)),
    };
    const groupRepository = {
      find: jest.fn(async () => metadata),
      findOne: jest.fn(async ({ where }: any) => metadata.find((row) => row.experimentId === where.experimentId && row.groupName === where.groupName) ?? null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const index = metadata.findIndex((row) => row.experimentId === value.experimentId && row.groupName === value.groupName);
        if (index >= 0) metadata[index] = value;
        else metadata.push(value);
        return value;
      }),
    };
    const scrapRepository = {
      find: jest.fn(async () => [{ experimentId, groupName: 'B' }]),
    };
    const dataSource = {
      getRepository: jest.fn((entity: any) => {
        if (entity.name === 'Experiment') return { findOne: async () => ({ id: experimentId, projectId: 'project', status: 'Draft' }) };
        if (entity.name === 'Project') return { findOne: async () => ({ id: 'project' }) };
        if (entity.name === 'SolutionPreparation') return solutionRepository;
        if (entity.name === 'SolutionPreparationGroup') return groupRepository;
        if (entity.name === 'ScrappedSolutionGroup') return scrapRepository;
        throw new Error(`Unexpected repository: ${entity.name}`);
      }),
    };
    (dataSource as any).transaction = async (work: any) => work({ getRepository: dataSource.getRepository });
    service = new DataService(dataSource as any, {} as any, {} as any, {} as any);
  });

  it('returns distinct existing groups with empty formula strings and scrap state', async () => {
    await expect(service.getSolutionPreparationGroups(experimentId)).resolves.toEqual([
      { groupName: 'A', formulaInfo: '', scrapped: false },
      { groupName: 'B', formulaInfo: '', scrapped: true },
    ]);
  });

  it('preserves an ordinary formula string exactly', async () => {
    const formulaInfo = 'LiPF6 100g + EC 200g';

    await expect(service.updateSolutionPreparationGroup(experimentId, 'A', formulaInfo))
      .resolves.toMatchObject({ groupName: 'A', formulaInfo });
    await expect(service.getSolutionPreparationGroups(experimentId)).resolves.toContainEqual({
      groupName: 'A', formulaInfo, scrapped: false,
    });
  });

  it('allows an empty formula string and overwrites the previous value', async () => {
    await service.updateSolutionPreparationGroup(experimentId, 'A', 'first');

    await expect(service.updateSolutionPreparationGroup(experimentId, 'A', ''))
      .resolves.toMatchObject({ groupName: 'A', formulaInfo: '' });
  });

  it('rejects updates for a group that does not exist in the experiment', async () => {
    await expect(service.updateSolutionPreparationGroup(experimentId, 'missing', 'formula'))
      .rejects.toThrow(NotFoundException);
  });
});
