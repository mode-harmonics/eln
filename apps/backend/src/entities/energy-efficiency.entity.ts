import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * energyEfficiency — 能效数据表
 * Charge/discharge energy conversion efficiency per cell.
 */
@Entity('energyEfficiency')
export class EnergyEfficiency {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellName!: string;

  /** Discharge Energy. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  de!: string | null;

  /** Charge Energy. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  ce!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}