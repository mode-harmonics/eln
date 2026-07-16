import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * workflowTemplate — 流程模板表
 * 存储系统内置和用户自定义的流程模板，含步骤定义（jsonb）
 */
@Entity('workflowTemplate', { comment: '流程模板表' })
export class WorkflowTemplate {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Column({ type: 'varchar', length: 128, comment: '模板名称' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: '模板描述' })
  description!: string | null;

  @Column({ name: 'isDefault', type: 'boolean', default: false, comment: '是否系统内置默认模板' })
  isDefault!: boolean;

  @Column({ type: 'jsonb', comment: '步骤定义数组' })
  steps!: Array<{
    name: string;
    label: string;
    builtInStep?: string;
    isParallel?: boolean;
    parallelChildren?: string[];
    sortOrder: number;
  }>;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
