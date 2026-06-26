import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('experimentCollaborators')
@Index(['experimentId', 'userId'], { unique: true })
export class ExperimentCollaboratorEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid' })
  experimentId: string;

  @Index()
  @Column({ name: 'userId', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  role: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
