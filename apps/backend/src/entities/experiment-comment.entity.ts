import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';

@Entity('experiment_comment', { comment: '实验评论表' })
export class ExperimentComment {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ name: 'userId', type: 'uuid', comment: '评论者用户ID' })
  userId!: string;

  @Column({ type: 'text', comment: '评论内容' })
  content!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
