import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * calendarLife — 日历寿命数据表
 * Wide source workbooks (q_0d, q_7d, ddcr_0d, ...) are flattened into one
 * row per (cellName, dayCount) by CalendarLifeParser. See parser for the
 * 4 post-processing fallback rules referenced in BACKEND_SPEC.md §二.10.
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
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** True if the source sheet laid this cell's days out horizontally. */
  @Column({ type: 'boolean', default: true, comment: '是否水平布局' })
  isHorizontal!: boolean;

  /** Measurement day (0, 7, 14, 21, 28, 35, 42, ...). */
  @Index()
  @Column({ type: 'int', comment: '天数' })
  dayCount!: number;

  /** Measured capacity at this day (q_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '容量(q)' })
  q!: string | null;

  /** Capacity loss/retention delta vs. day 0 (dq_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '容量衰减(dq)' })
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

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}