import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * workflowInstance — 流程实例表
 * 每个项目有一个流程实例，追踪当前执行进度
 */
@Entity('workflowInstance', { comment: '流程实例表' })
export class WorkflowInstance {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'projectId', type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Index()
  @Column({ name: 'templateId', type: 'uuid', comment: '模板ID' })
  templateId!: string;

  @Column({ type: 'varchar', length: 32, default: 'Active', comment: '状态(Active/Completed/Paused)' })
  status!: string;

  @Column({ name: 'currentStepIndex', type: 'int', default: 0, comment: '当前步骤索引' })
  currentStepIndex!: number;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
