import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('roles')
export class RoleEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'permissionList', type: 'jsonb', nullable: true })
  permissionList: string[] | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
