import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * dcrTest — 4C DCR 直流内阻数据表
 * High-rate pulse voltage/current response per cell.
 *
 * Computed fields (stored, not calculated at query time):
 *   ddcr       = |du1 - du0| / di      放电直流内阻 (Ω)
 *   cdcr       = |cu1 - cu0| / ci      充电直流内阻 (Ω)
 *   dRcProduct = q0 * ddcr             放电R-C乘积 (Ah·Ω)
 *   cRcProduct = q0 * cdcr             充电R-C乘积 (Ah·Ω)
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

  // ─── Derived / computed fields (计算字段，解析时写入) ────────────────────

  /** 放电直流内阻 = |du1 - du0| / di (Ω) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电直流内阻 ddcr=|du1-du0|/di (Ω)' })
  ddcr!: string | null;

  /** 充电直流内阻 = |cu1 - cu0| / ci (Ω) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电直流内阻 cdcr=|cu1-cu0|/ci (Ω)' })
  cdcr!: string | null;

  /** 放电R-C乘积 = q0 * ddcr (Ah·Ω) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '放电R-C乘积 dRcProduct=q0*ddcr (Ah·Ω)' })
  dRcProduct!: string | null;

  /** 充电R-C乘积 = q0 * cdcr (Ah·Ω) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '充电R-C乘积 cRcProduct=q0*cdcr (Ah·Ω)' })
  cRcProduct!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}