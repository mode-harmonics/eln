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
@Entity('fastCharge', { comment: '快充时间工步表' })
export class FastCharge {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** Nominal capacity (commonly 3.0 or recipe-specific). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '标称容量(c0)' })
  c0!: string | null;

  /** Parsed total fast-charge time (minutes). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '提供的快充时间' })
  providedFastChargeTime!: string | null;

  /** [{ stepNo, rate, cutOffVoltage, current, stepCapacity, stepTime }] */
  @Column({ type: 'jsonb', nullable: true, comment: '快充工步数据' })
  steps!: FastChargeStep[] | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}