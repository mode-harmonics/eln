import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  it('loads the summary for the authenticated JWT user id', async () => {
    const summary = { pendingApprovals: [{ id: 'review-experiment' }] };
    const getSummary = jest.fn().mockResolvedValue(summary);
    const controller = new DashboardController({ getSummary } as unknown as DashboardService);

    const result = await controller.getSummary({ user: { id: 'reviewer-id', permissionList: ['experiments:read'] } });

    expect(getSummary).toHaveBeenCalledWith('reviewer-id', ['experiments:read']);
    expect(result).toEqual({ success: true, data: summary });
  });
});
