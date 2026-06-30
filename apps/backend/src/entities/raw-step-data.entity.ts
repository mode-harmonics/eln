import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * rawStepData — 原始工步数据表
 * Stores raw "step" (工步层) sheet rows from machine-exported Excel.
 * Shared by all experiment types (ProcessData, CalendarLife, DcrTest, etc.)
 * and aggregated into their respective business tables.
 */
@Entity('rawStepData', { comment: '原始工步数据表' })
export class RawStepData {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** Cycle number (循环号). */
  @Column({ type: 'int', comment: '循环号' })
  cycleNo!: number;

  /** Step number within current cycle (工步号). */
  @Column({ type: 'int', comment: '工步号' })
  stepNo!: number;

  /** Absolute step sequence number (工步序号). */
  @Column({ type: 'int', comment: '工步序号' })
  stepSeqNo!: number;

  /** Step type: 搁置, 恒流放电, 恒流充电, etc. */
  @Column({ type: 'varchar', length: 32, comment: '工步类型' })
  stepType!: string;

  /** Step duration (工步时间). */
  @Column({ type: 'varchar', length: 16, nullable: true, comment: '工步时间' })
  stepTime!: string | null;

  /** Capacity or energy (容量/能量). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '容量/能量' })
  capacity!: string | null;

  /** Start voltage (起始电压). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '起始电压(V)' })
  startVoltage!: string | null;

  /** End voltage (结束电压). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '结束电压(V)' })
  endVoltage!: string | null;

  /** Start current (起始电流). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '起始电流(A)' })
  startCurrent!: string | null;

  /** End current (结束电流). */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '结束电流(A)' })
  endCurrent!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
