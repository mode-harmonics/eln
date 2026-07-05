import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * calendarLife — 日历寿命数据表
 * Wide source workbooks (q_0d, q_7d, ddcr_0d, ...) are flattened into one
 * row per (cellName, dayCount) by CalendarLifeParser. See parser for the
 * 4 post-processing fallback rules referenced in BACKEND_SPEC.md §二.10.
 *
 * Computed fields (stored, relative to the day=0 row of the same cellName):
 *   qRetention  = (dq / q_0d) * 100          容量保持率 (%)
 *   qRecovery   = (q  / q_0d) * 100          容量恢复率 (%)
 *   ddcrGrowth  = (ddcr / ddcr_0d - 1) * 100 放电DCR增长 (%)
 *   cdcrGrowth  = (cdcr / cdcr_0d - 1) * 100 充电DCR增长 (%)
 *   uGrowth     = (u   / u_0d   - 1) * 100   电压增长 (%)
 *   rGrowth     = (r   / r_0d   - 1) * 100   内阻增长 (%)
 *   (day=0 row: qRetention=100, qRecovery=100, all growth=0)
 */
@Entity('calendarLife', { comment: '日历寿命数据表' })
export class CalendarLife {
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



  /** Measurement day (0, 7, 14, 21, 28, 35, 42, ...). */
  @Index()
  @Column({ type: 'int', comment: '天数' })
  dayCount!: number;

  /** Rated / grading capacity at this day (q_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '定容容量(q)' })
  q!: string | null;

  /** First discharge capacity at this day (dq_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '首次放电容量(dq)' })
  dq!: string | null;

  /** Discharge DC internal resistance (ddcr_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电直流内阻(ddcr)' })
  ddcr!: string | null;

  /** Charge DC internal resistance (cdcr_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电直流内阻(cdcr)' })
  cdcr!: string | null;

  /** Measured voltage (u_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '电压(u)' })
  u!: string | null;

  /** Measured AC internal resistance (r_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '交流内阻(r)' })
  r!: string | null;

  // ─── Derived / computed fields (计算字段，解析时基于 day=0 基准写入) ────────

  /** 容量保持率 = (dq / q_0d) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '容量保持率 qRetention=dq/q0d*100 (%)' })
  qRetention!: string | null;

  /** 容量恢复率 = (q / q_0d) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '容量恢复率 qRecovery=q/q0d*100 (%)' })
  qRecovery!: string | null;

  /** 放电DCR增长 = (ddcr / ddcr_0d - 1) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电DCR增长 ddcrGrowth=(ddcr/ddcr0d-1)*100 (%)' })
  ddcrGrowth!: string | null;

  /** 充电DCR增长 = (cdcr / cdcr_0d - 1) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电DCR增长 cdcrGrowth=(cdcr/cdcr0d-1)*100 (%)' })
  cdcrGrowth!: string | null;

  /** 电压增长 = (u / u_0d - 1) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '电压增长 uGrowth=(u/u0d-1)*100 (%)' })
  uGrowth!: string | null;

  /** 内阻增长 = (r / r_0d - 1) * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '内阻增长 rGrowth=(r/r0d-1)*100 (%)' })
  rGrowth!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}