import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * dcrTest — 4C DCR 直流内阻数据表
 * High-rate pulse voltage/current response per cell.
 */
@Entity('dcrTest', { comment: '直流内阻测试数据表' })
export class DcrTest {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯名称' })
  cellName!: string;

  /** Capacity before the test SOC point. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '测试前容量(q0)' })
  q0!: string | null;

  /** Voltage before discharge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电脉冲前电压(du0)' })
  du0!: string | null;

  /** Voltage after discharge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电脉冲后电压(du1)' })
  du1!: string | null;

  /** Discharge pulse current. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电脉冲电流(di)' })
  di!: string | null;

  /** Voltage before charge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电脉冲前电压(cu0)' })
  cu0!: string | null;

  /** Voltage after charge pulse. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电脉冲后电压(cu1)' })
  cu1!: string | null;

  /** Charge pulse current. */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电脉冲电流(ci)' })
  ci!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}