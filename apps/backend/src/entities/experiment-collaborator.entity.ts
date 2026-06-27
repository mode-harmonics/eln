import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * experimentCollaborator — 实验协作人员表
 */
@Entity('experimentCollaborator', { comment: '实验协作人员表' })
@Index(['experimentId', 'userId'], { unique: true })
export class ExperimentCollaborator {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ name: 'userId', type: 'uuid', comment: 'userId' })
  userId!: string;

  @Column({ type: 'varchar', length: 32, comment: '协作角色' })
  role!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
