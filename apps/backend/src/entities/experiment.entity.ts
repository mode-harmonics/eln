import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * experiment — 实验表
 */
@Entity('experiment', { comment: '实验表' })
export class Experiment {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'projectId', type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Column({ type: 'varchar', length: 255, comment: '实验标题' })
  title!: string;

  @Column({ type: 'text', nullable: true, comment: '实验内容' })
  content!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'Draft', comment: '状态' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true, comment: '元数据' })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'aiAnalysisOutput', type: 'text', nullable: true, comment: 'AI分析输出' })
  aiAnalysisOutput!: string | null;

  @Column({ name: 'versionNo', type: 'int', default: 1, comment: '版本号' })
  versionNo!: number;

  @Column({ name: 'cellPicked', type: 'boolean', default: false, comment: '是否已完成电池挑选' })
  cellPicked!: boolean;

  @Index()
  @Column({ name: 'createdBy', type: 'uuid', comment: '创建者ID' })
  createdBy!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
