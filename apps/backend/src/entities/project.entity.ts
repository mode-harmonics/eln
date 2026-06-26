import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('projects')
export class ProjectEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, default: 'Active' })
  status: string;

  @Index()
  @Column({ name: 'createdBy', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
