import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * storageSwelling — 60℃存储胀气数据表
 * Same vertical-flatten shape as calendarLife: one row per
 * (cellName, dayCount), parsed from a horizontally-laid-out source sheet.
 */
@Entity('storageSwelling')
export class StorageSwelling {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellName!: string;

  /** First-cycle / baseline reference capacity (qd_1st). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  qd1st!: string | null;

  /** Storage measurement day. */
  @Index()
  @Column({ type: 'int' })
  dayCount!: number;

  /** Swelling volume at this day (v_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  v!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}