import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * project — 项目表
 */
@Entity('project', { comment: '项目表' })
export class Project {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Column({ type: 'varchar', length: 128, comment: '项目名称' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'Active', comment: '状态' })
  status!: string;

  @Index()
  @Column({ name: 'createdBy', type: 'uuid', comment: '创建者ID' })
  createdBy!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
