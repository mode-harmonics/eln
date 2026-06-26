import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('versionHistory')
export class VersionHistoryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid' })
  experimentId: string;

  @Column({ name: 'versionNumber', type: 'int' })
  versionNumber: number;

  @Column({ name: 'changeSummary', type: 'varchar', length: 255, nullable: true })
  changeSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'updatedBy', type: 'uuid' })
  updatedBy: string;

  @CreateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
