import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One row of a step-charge ladder, folded from a horizontal source layout. */
export interface FastChargeStep {
  stepNo: number;
  rate: number | null;
  cutOffVoltage: number | null;
  current: number | null;
  stepCapacity: number | null;
  stepTime: number | null;
}

/**
 * fastCharge — 快充时间工步表
 * Stepped constant-current fast-charge ladder per cell. The variable-length
 * step list is folded into a single JSONB array column instead of one
 * column per step, since the number of steps varies by recipe.
 */
@Entity('fastCharge')
export class FastCharge {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellName!: string;

  /** Nominal capacity (commonly 3.0 or recipe-specific). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  c0!: string | null;

  /** Parsed total fast-charge time (minutes). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  providedFastChargeTime!: string | null;

  /** [{ stepNo, rate, cutOffVoltage, current, stepCapacity, stepTime }] */
  @Column({ type: 'jsonb', nullable: true })
  steps!: FastChargeStep[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}