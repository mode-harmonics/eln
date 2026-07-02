import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async createNotification(
    userId: string,
    type: string,
    payload: Record<string, any>,
    relatedExperimentId?: string,
  ): Promise<Notification> {
    const notif = this.notificationRepo.create({
      id: uuid(),
      userId,
      type,
      payload,
      relatedExperimentId,
      isRead: false,
    });
    return this.notificationRepo.save(notif);
  }

  async getMyNotifications(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notif = await this.notificationRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    return this.notificationRepo.save(notif);
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
    return { success: true };
  }
}
