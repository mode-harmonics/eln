import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * storageSwelling — 60℃存储胀气数据表
 * Same vertical-flatten shape as calendarLife: one row per
 * (cellName, dayCount), parsed from a horizontally-laid-out source sheet.
 *
 * Computed field (stored, relative to the day=0 row of the same cellName):
 *   vg = (v - v_0d) / qd1st    产气量 (mL/Ah)
 *   (day=0 row: vg = 0)
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
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '存储后电池体积(v)' })
  v!: string | null;

  // ─── Derived / computed field (计算字段，解析时基于 day=0 基准写入) ─────────

  /** 产气量 = (v - v_0d) / qd1st (mL/Ah); day=0 row stores 0 */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '产气量 vg=(v-v0d)/qd1st (mL/Ah)' })
  vg!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}