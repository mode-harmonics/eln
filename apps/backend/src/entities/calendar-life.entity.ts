import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * calendarLife — 日历寿命数据表
 * Wide source workbooks (q_0d, q_7d, ddcr_0d, ...) are flattened into one
 * row per (cellName, dayCount) by CalendarLifeParser. See parser for the
 * 4 post-processing fallback rules referenced in BACKEND_SPEC.md §二.10.
 */
@Entity('calendarLife')
export class CalendarLife {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellName!: string;

  /** True if the source sheet laid this cell's days out horizontally. */
  @Column({ type: 'boolean', default: true })
  isHorizontal!: boolean;

  /** Measurement day (0, 7, 14, 21, 28, 35, 42, ...). */
  @Index()
  @Column({ type: 'int' })
  dayCount!: number;

  /** Measured capacity at this day (q_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  q!: string | null;

  /** Capacity loss/retention delta vs. day 0 (dq_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  dq!: string | null;

  /** Discharge DC internal resistance (ddcr_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  ddcr!: string | null;

  /** Charge DC internal resistance (cdcr_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  cdcr!: string | null;

  /** Measured voltage (u_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  u!: string | null;

  /** Measured AC internal resistance (r_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  r!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}