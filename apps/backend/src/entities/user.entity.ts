import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  email: string;

  @Column({ name: 'passwordHash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'fullName', type: 'varchar', length: 64 })
  fullName: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar: string | null;

  @Index()
  @Column({ name: 'roleId', type: 'uuid', nullable: true })
  roleId: string | null;

  @Column({ name: 'departmentId', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
