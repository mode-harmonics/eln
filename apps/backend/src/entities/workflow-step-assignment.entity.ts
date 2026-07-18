import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * workflowStepAssignment — 流程步骤分配表
 * 每个步骤的人员分配、权限设置和执行状态
 */
@Entity('workflowStepAssignment', { comment: '流程步骤分配表' })
export class WorkflowStepAssignment {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'workflowInstanceId', type: 'uuid', comment: '流程实例ID' })
  workflowInstanceId!: string;

  @Column({ name: 'stepName', type: 'varchar', length: 64, comment: '步骤名称(key)' })
  stepName!: string;

  @Index()
  @Column({ name: 'stepIndex', type: 'int', comment: '步骤序号' })
  stepIndex!: number;

  @Index()
  @Column({ name: 'assignedUserId', type: 'uuid', nullable: true, comment: '分配执行人ID' })
  assignedUserId!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending', comment: '步骤状态(pending/in_progress/completed/skipped)' })
  status!: string;

  @Column({ name: 'canViewOtherSteps', type: 'boolean', default: false, comment: '能否查看其他步骤' })
  canViewOtherSteps!: boolean;

  @Column({ name: 'canViewInternalCode', type: 'boolean', default: false, comment: '能否查看内部代码' })
  canViewInternalCode!: boolean;

  @Column({ name: 'visibleToUserIds', type: 'jsonb', nullable: true, comment: '允许查看该步骤的其他人员ID列表' })
  visibleToUserIds!: string[] | null;

  @Column({ name: 'isParallelGroup', type: 'boolean', default: false, comment: '是否为并行组节点(如testing)' })
  isParallelGroup!: boolean;

  @Column({ name: 'parentStepName', type: 'varchar', length: 64, nullable: true, comment: '父级并行组步骤名称' })
  parentStepName!: string | null;

  @Column({ name: 'completedAt', type: 'timestamp', nullable: true, comment: '完成时间' })
  completedAt!: Date | null;

  @Column({ name: 'completedBy', type: 'uuid', nullable: true, comment: '完成人ID' })
  completedBy!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
