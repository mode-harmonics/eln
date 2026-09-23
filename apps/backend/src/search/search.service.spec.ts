import { SearchService } from './search.service';
import { AccessService } from '../access/access.service';
import { RequestUser } from '../common/decorators/current-user.decorator';

describe('SearchService visibility', () => {
  it('applies resource scope before the result limit for both searches', async () => {
    const builder = () => { const qb: any = { getMany: jest.fn().mockResolvedValue([]) }; for (const key of ['where', 'andWhere', 'limit']) qb[key] = jest.fn().mockReturnValue(qb); return qb; };
    const projects = builder();
    const experiments = builder();
    const user = { id: 'reader' } as RequestUser;
    const access = { visibleScope: jest.fn().mockResolvedValue({ projectIds: ['visible-project'], experimentIds: ['visible-experiment'] }) };
    const service = new SearchService({ createQueryBuilder: () => projects } as any, { createQueryBuilder: () => experiments } as any, access as unknown as AccessService);
    await expect(service.search('secret', user)).resolves.toEqual([]);
    expect(access.visibleScope).toHaveBeenCalledWith(user);
    expect(projects.andWhere).toHaveBeenCalledWith('p.id IN (:...ids)', { ids: ['visible-project'] });
    expect(experiments.andWhere).toHaveBeenCalledWith('e.id IN (:...ids)', { ids: ['visible-experiment'] });
    expect(experiments.andWhere.mock.invocationCallOrder[0]).toBeLessThan(experiments.limit.mock.invocationCallOrder[0]);
  });
});
