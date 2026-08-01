import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';

/**
 * role — 角色表
 */
@Entity('role', { comment: '角色表' })
export class Role {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '角色名称' })
  name!: string;

  @Column({ name: 'permissionList', type: 'jsonb', nullable: true, comment: '权限列表' })
  permissionList!: string[] | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
