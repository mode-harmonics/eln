import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('notification', { comment: '系统通知表' })
export class Notification {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'userId', type: 'uuid', comment: '接收者用户ID' })
  userId!: string;

  @Column({ type: 'varchar', length: 64, comment: '通知类型(如 REVIEW_SUBMITTED)' })
  type!: string;

  @Column({ type: 'jsonb', nullable: true, comment: '附加负载数据' })
  payload!: Record<string, any> | null;

  @Column({ name: 'relatedExperimentId', type: 'uuid', nullable: true, comment: '关联实验ID' })
  relatedExperimentId!: string | null;

  @Index()
  @Column({ name: 'isRead', type: 'boolean', default: false, comment: '是否已读' })
  isRead!: boolean;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
