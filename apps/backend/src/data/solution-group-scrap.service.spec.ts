import { BadRequestException } from '@nestjs/common';
import { DataService } from './data.service';

describe('DataService solution group scrapping', () => {
  const experimentId = 'experiment-1';
  const userId = 'user-1';
  let existingScrap: any;
  let scrapRepository: any;
  let solutionRepository: any;
  let service: DataService;

  beforeEach(() => {
    existingScrap = null;
    solutionRepository = {
      exist: jest.fn(async ({ where }: any) => where.groupName === 'A'),
    };
    scrapRepository = {
      find: jest.fn(async () => existingScrap ? [existingScrap] : []),
      findOne: jest.fn(async () => existingScrap),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => { existingScrap = value; return value; }),
      remove: jest.fn(async () => existingScrap = null),
    };
    const dataSource = {
      getRepository: jest.fn((entity: any) => entity.name === 'SolutionPreparation' ? solutionRepository : scrapRepository),
    };
    service = new DataService(dataSource as any, {} as any, {} as any, {} as any);
  });

  it('rejects scrapping a group that does not exist in the experiment', async () => {
    await expect(service.scrapSolutionGroup(experimentId, 'missing', userId))
      .rejects.toThrow(BadRequestException);
  });

  it('creates one scrap status for the whole group', async () => {
    await expect(service.scrapSolutionGroup(experimentId, 'A', userId, 'contaminated'))
      .resolves.toMatchObject({ experimentId, groupName: 'A', reason: 'contaminated', scrappedBy: userId });
  });

  it('returns the existing status when the same group is scrapped repeatedly', async () => {
    const first = await service.scrapSolutionGroup(experimentId, 'A', userId);
    const second = await service.scrapSolutionGroup(experimentId, 'A', userId);

    expect(second).toBe(first);
    expect(scrapRepository.save).toHaveBeenCalledTimes(1);
  });

  it('restores a scrapped group by deleting its status', async () => {
    await service.scrapSolutionGroup(experimentId, 'A', userId);

    await expect(service.restoreSolutionGroup(experimentId, 'A')).resolves.toEqual({ success: true });
    expect(scrapRepository.remove).toHaveBeenCalledTimes(1);
  });
});
