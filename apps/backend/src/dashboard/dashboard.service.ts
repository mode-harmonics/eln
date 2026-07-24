import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';
import { ExperimentComment } from '../entities/experiment-comment.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { ExperimentStatus } from '@eln/shared';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
    @InjectRepository(VersionHistory)
    private readonly versionHistoryRepo: Repository<VersionHistory>,
    @InjectRepository(ExperimentComment)
    private readonly commentRepo: Repository<ExperimentComment>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getSummary(userId: string) {
    // 1. Project Status Distribution
    const projectStatusCounts = await this.projectRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(p.id)', 'count')
      .groupBy('p.status')
      .getRawMany();

    // 2. Experiment Status Distribution
    const experimentStatusCounts = await this.experimentRepo
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('e.status')
      .getRawMany();

    // 3. Pending Approvals for this user
    // In Phase 1, `reviewerId` was added to `Experiment` to track the assigned reviewer.
    const pendingApprovals = await this.experimentRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.title', 'e.status', 'e.updatedAt', 'e.projectId'])
      .where('e.status = :status', { status: ExperimentStatus.InReview })
      .andWhere('e.reviewerId = :reviewerId', { reviewerId: userId })
      .orderBy('e.updatedAt', 'DESC')
      .getMany();

    // Attach project names to pending approvals
    const projectIds = [...new Set(pendingApprovals.map(e => e.projectId))];
    const projects = projectIds.length ? await this.projectRepo.findByIds(projectIds) : [];
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    
    const formattedPendingApprovals = pendingApprovals.map(e => ({
      id: e.id,
      title: e.title,
      status: e.status,
      updatedAt: e.updatedAt,
      projectId: e.projectId,
      projectName: projectMap.get(e.projectId) || 'Unknown Project',
    }));

    // 4. Recent Activities (combining VersionHistory, Comments, Notifications)
    const activities = [];

    // Notifications for user
    const notifications = await this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    
    for (const n of notifications) {
      activities.push({
        id: `notif_${n.id}`,
        type: 'notification',
        action: n.type,
        experimentId: n.relatedExperimentId,
        timestamp: n.createdAt,
        payload: n.payload,
      });
    }

    // Comments globally (or could scope to user's projects)
    const comments = await this.commentRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const commentUserIds = [...new Set(comments.map(c => c.userId))];
    const commentUsers = commentUserIds.length ? await this.userRepo.findByIds(commentUserIds) : [];
    const userMap = new Map(commentUsers.map(u => [u.id, u.fullName || u.username]));

    for (const c of comments) {
      activities.push({
        id: `comment_${c.id}`,
        type: 'comment',
        action: 'Added a comment',
        content: c.content,
        experimentId: c.experimentId,
        user: userMap.get(c.userId) || 'Unknown User',
        timestamp: c.createdAt,
      });
    }

    // Version History globally
    const histories = await this.versionHistoryRepo.find({
      order: { updatedAt: 'DESC' },
      take: 10,
    });
    const historyUserIds = [...new Set(histories.map(h => h.updatedBy))];
    const historyUsers = historyUserIds.length ? await this.userRepo.findByIds(historyUserIds) : [];
    const historyUserMap = new Map(historyUsers.map(u => [u.id, u.fullName || u.username]));

    for (const h of histories) {
      activities.push({
        id: `history_${h.id}`,
        type: 'version',
        action: h.changeSummary || `Updated to version ${h.versionNumber}`,
        experimentId: h.experimentId,
        user: historyUserMap.get(h.updatedBy) || 'Unknown User',
        timestamp: h.updatedAt,
      });
    }

    // Sort and take top 15 recent activities overall
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = activities.slice(0, 15);

    // Attach experiment routing data to activities.
    const activityExpIds = [...new Set(recentActivities.map(a => a.experimentId).filter(Boolean))];
    const activityExps = activityExpIds.length ? await this.experimentRepo.findByIds(activityExpIds as string[]) : [];
    const activityExpMap = new Map(activityExps.map(e => [e.id, { title: e.title, projectId: e.projectId }]));
    
    for (const a of recentActivities) {
      if (a.experimentId) {
        const experiment = activityExpMap.get(a.experimentId);
        (a as any).experimentTitle = experiment?.title || 'Unknown Experiment';
        (a as any).projectId = experiment?.projectId;
      }
    }

    return {
      projectStatusDistribution: projectStatusCounts.map(item => ({
        status: item.status,
        count: parseInt(item.count, 10),
      })),
      experimentStatusDistribution: experimentStatusCounts.map(item => ({
        status: item.status,
        count: parseInt(item.count, 10),
      })),
      pendingApprovals: formattedPendingApprovals,
      recentActivities,
    };
  }
}
