import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * dcrTest — 4C DCR 直流内阻数据表
 * High-rate pulse voltage/current response per cell.
 */
@Entity('dcrTest')
export class DcrTest {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellName!: string;

  /** Capacity before the test SOC point. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  q0!: string | null;

  /** Voltage before discharge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  du0!: string | null;

  /** Voltage after discharge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  du1!: string | null;

  /** Discharge pulse current. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  di!: string | null;

  /** Voltage before charge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  cu0!: string | null;

  /** Voltage after charge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  cu1!: string | null;

  /** Charge pulse current. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  ci!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}