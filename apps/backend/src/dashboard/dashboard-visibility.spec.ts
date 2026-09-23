import { DashboardService } from './dashboard.service';
import { AccessService } from '../access/access.service';

describe('DashboardService visibility', () => {
  it('scopes distributions, approvals, comments and history and drops inaccessible notification payloads', async () => {
    const query = () => { const q: any = { getRawMany: jest.fn().mockResolvedValue([]), getMany: jest.fn().mockResolvedValue([]) }; for (const k of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy']) q[k] = jest.fn().mockReturnValue(q); return q; };
    const pq = query(); const eq = query();
    const projects = { createQueryBuilder: () => pq, findByIds: jest.fn().mockResolvedValue([]) };
    const experiments = { createQueryBuilder: () => eq, findByIds: jest.fn().mockResolvedValue([]) };
    const histories = { find: jest.fn().mockResolvedValue([]) };
    const comments = { find: jest.fn().mockResolvedValue([]) };
    const notifications = { find: jest.fn().mockResolvedValue([{ id: 'private', relatedExperimentId: 'hidden', payload: { secret: true }, createdAt: new Date() }]) };
    const users = { findByIds: jest.fn().mockResolvedValue([]) };
    const access = { visibleScope: jest.fn().mockResolvedValue({ projectIds: ['p'], experimentIds: ['e'] }) };
    const service = new DashboardService(projects as any, experiments as any, histories as any, comments as any, notifications as any, users as any, access as unknown as AccessService);
    const result = await service.getSummary('reader', ['experiments:read']);
    expect(pq.where).toHaveBeenCalledWith('p.id IN (:...projectScope)', { projectScope: ['p'] });
    expect(eq.where).toHaveBeenCalledWith('e.id IN (:...experimentScope)', { experimentScope: ['e'] });
    expect(eq.andWhere).toHaveBeenCalledWith('e.id IN (:...experimentScope)', { experimentScope: ['e'] });
    expect(comments.find.mock.calls[0][0].where.experimentId.value).toEqual(['e']);
    expect(histories.find.mock.calls[0][0].where.experimentId.value).toEqual(['e']);
    expect(result.recentActivities).toEqual([]);
  });
});
