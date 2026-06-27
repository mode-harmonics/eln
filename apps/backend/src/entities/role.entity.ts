import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('role')
export class Role {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ name: 'permissionList', type: 'jsonb', nullable: true })
  permissionList!: string[] | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
