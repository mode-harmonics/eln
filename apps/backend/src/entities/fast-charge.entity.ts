import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One row of a step-charge ladder, folded from a horizontal source layout. */
export interface FastChargeStep {
  stepNo: number;
  rate: number | string | null;  // e.g. "4C0" or numeric
  cutOffVoltage: number | null;
  current: number | null;
  stepCapacity: number | null;
  stepTime: number | null;
  /** 单步SOC增量 = stepCapacity / c0 (computed at parse time) */
  stepSoc: number | null;
  /** 累计SOC = sum of stepSoc up to and including this step (computed at parse time) */
  cumulativeSoc: number | null;
}

/**
 * fastCharge — 快充时间工步表
 * Stepped constant-current fast-charge ladder per cell. The variable-length
 * step list is folded into a single JSONB array column instead of one
 * column per step, since the number of steps varies by recipe.
 *
 * Computed fields (stored at parse time):
 *   steps[i].stepSoc      = stepCapacity / c0          单步SOC增量
 *   steps[i].cumulativeSoc = cumulative sum of stepSoc   累计SOC
 *   computedFastChargeTime = t(80%SOC) - t(10%SOC)      10%-80%SOC快充时间 (min)
 *   (via linear interpolation over the (cumulativeSoc, elapsed-time) timeline)
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
  @Column({ name: 'attachmentId', type: 'uuid', nullable: true, comment: '关联附件ID' })
  attachmentId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** Nominal capacity (commonly 3.0 or recipe-specific). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '标称容量(c0)' })
  c0!: string | null;

  /** Parsed total fast-charge time from source sheet (minutes); may be null if not provided. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '提供的快充时间' })
  providedFastChargeTime!: string | null;

  /**
   * 10%∙80% SOC 快充时间，根据工步梯度计算 (min)。
   * 若 Excel 提供了 providedFastChargeTime 则优先使用；否则自动计算。
   */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '计算10%-80%SOC快充时间 computedFastChargeTime (min)' })
  computedFastChargeTime!: string | null;

  /** [{ stepNo, rate, cutOffVoltage, current, stepCapacity, stepTime }] */
  @Column({ type: 'jsonb', nullable: true, comment: '快充工步数据' })
  steps!: FastChargeStep[] | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}