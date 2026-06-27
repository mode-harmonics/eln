import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * storageSwelling — 60℃存储胀气数据表
 * Same vertical-flatten shape as calendarLife: one row per
 * (cellName, dayCount), parsed from a horizontally-laid-out source sheet.
 */
@Entity('storageSwelling', { comment: '存储胀气数据表' })
export class StorageSwelling {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** First-cycle / baseline reference capacity (qd_1st). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '首圈放电容量(qd1st)' })
  qd1st!: string | null;

  /** Storage measurement day. */
  @Index()
  @Column({ type: 'int', comment: '天数' })
  dayCount!: number;

  /** Swelling volume at this day (v_Xd). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '胀气后体积(v)' })
  v!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}