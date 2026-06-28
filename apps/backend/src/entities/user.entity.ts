import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * user — 用户表
 */
@Entity('user', { comment: '用户表' })
export class User {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, comment: '邮箱' })
  email!: string;

  @Column({ name: 'passwordHash', type: 'varchar', length: 255, comment: '密码哈希' })
  passwordHash!: string;

  @Column({ name: 'fullName', type: 'varchar', length: 64, comment: '姓名' })
  fullName!: string;

  @Column({ type: 'varchar', length: 512, nullable: true, comment: '头像' })
  avatar!: string | null;

  @Index()
  @Column({ name: 'roleId', type: 'uuid', nullable: true, comment: '角色ID' })
  roleId!: string | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: Role | null;

  @Column({ name: 'departmentId', type: 'uuid', nullable: true, comment: '部门ID' })
  departmentId!: string | null;

  @Column({ name: 'isActive', type: 'boolean', default: true, comment: '是否启用' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
