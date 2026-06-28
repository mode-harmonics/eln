import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * processData — 制程数据表
 * Pre-shipment manufacturing process parameters per cell (weight, voltage,
 * internal resistance across formation/aging/grading stages).
 *
 * Computed fields (stored, not calculated at query time):
 *   mIn     = m1 - m0                    注液量
 *   mLoss   = m1 - m2                    失液量
 *   mHold   = m4 - m0                    保液量
 *   fq      = fq1 + fq2                  化成充总容量
 *   qdFirst = gqd1                       首次放电容量
 *   fvg     = (v1 - v0) / qdFirst        化成产气量 (mL/Ah)
 *   ku      = fu1 - fu2                  老化电压降
 *   qcFirst = fq + gqc1                  首次充电容量
 *   ceFirst = qdFirst / qcFirst * 100    首圈库比效率 (%)
 */
@Entity('processData', { comment: '制程数据表' })
export class ProcessData {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id (batch / run) */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  /** Cell unique code (aka batteryId in source workbooks). */
  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯编码' })
  cellId!: string;

  // --- Pre-formation weight stages ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '注液前电芯重(m0)' })
  m0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '预充后电芯重(m1)' })
  m1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '二封后电芯重(m2)' })
  m2!: string | null;

  // --- Stage voltages ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '二封前OCV(v0)' })
  v0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '二封后OCV(v1)' })
  v1!: string | null;

  // --- Pre-formation voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成前OCV(fu0)' })
  fu0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成前ACIR(fr0)' })
  fr0!: string | null;

  // --- Formation-stage capacity ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成充电容量(fq1)' })
  fq1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成放电容量(fq2)' })
  fq2!: string | null;

  // --- Formation mid/late voltage & internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成后电压1(fu1)' })
  fu1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成后电阻1(fr1)' })
  fr1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成后电压2(fu2)' })
  fu2!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成后电阻2(fr2)' })
  fr2!: string | null;

  // --- Post electrolyte-fill / second-seal weight ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '二封前称重(m3)' })
  m3!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '二封后称重(m4)' })
  m4!: string | null;

  // --- Pre-grading voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容前OCV(gu0)' })
  gu0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容前ACIR(gr0)' })
  gr0!: string | null;

  // --- Grading charge/discharge capacity ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容充电容量1(gqc1)' })
  gqc1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容放电容量1(gqd1)' })
  gqd1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容充电容量2(gqc2)' })
  gqc2!: string | null;

  // --- Post-grading (shipment) voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容后电压(gu1)' })
  gu1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '分容后电阻(gr1)' })
  gr1!: string | null;

  // ─── Derived / computed fields (计算字段，解析时写入，直接入库) ───────────────

  /** 注液量 = m1 - m0 (g) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '注液量 mIn=m1-m0 (g)' })
  mIn!: string | null;

  /** 失液量 = m1 - m2 (g) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '失液量 mLoss=m1-m2 (g)' })
  mLoss!: string | null;

  /** 保液量 = m4 - m0 (g) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '保液量 mHold=m4-m0 (g)' })
  mHold!: string | null;

  /** 化成充总容量 = fq1 + fq2 (Ah) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成充总容量 fq=fq1+fq2 (Ah)' })
  fq!: string | null;

  /** 首次放电容量 = gqd1 (Ah) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '首次放电容量 qdFirst=gqd1 (Ah)' })
  qdFirst!: string | null;

  /** 化成产气量 = (v1 - v0) / qdFirst (mL/Ah) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '化成产气量 fvg=(v1-v0)/qdFirst (mL/Ah)' })
  fvg!: string | null;

  /** 老化电压降 = fu1 - fu2 (V) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '老化电压降 ku=fu1-fu2 (V)' })
  ku!: string | null;

  /** 首次充电容量 = fq + gqc1 (Ah) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '首次充电容量 qcFirst=fq+gqc1 (Ah)' })
  qcFirst!: string | null;

  /** 首圈库比效率 = qdFirst / qcFirst * 100 (%) */
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '首圈库比效率 ceFirst=qdFirst/qcFirst*100 (%)' })
  ceFirst!: string | null;



  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}