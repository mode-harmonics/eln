import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * versionHistory — 版本历史表
 */
@Entity('versionHistory', { comment: '版本历史表' })
export class VersionHistory {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Column({ name: 'versionNumber', type: 'int', comment: '版本号' })
  versionNumber!: number;

  @Column({ name: 'changeSummary', type: 'varchar', length: 255, nullable: true, comment: '变更摘要' })
  changeSummary!: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '快照数据' })
  snapshot!: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'updatedBy', type: 'uuid', comment: '更新者ID' })
  updatedBy!: string;

  @CreateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
