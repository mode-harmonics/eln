import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * energyEfficiency — 能效数据表
 * Charge/discharge energy conversion efficiency per cell.
 */
@Entity('energyEfficiency', { comment: '能效数据表' })
export class EnergyEfficiency {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** Discharge Energy. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电能量(de)' })
  de!: string | null;

  /** Charge Energy. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电能量(ce)' })
  ce!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '备注' })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}