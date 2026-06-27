import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * processData — 制程数据表
 * Pre-shipment manufacturing process parameters per cell (weight, voltage,
 * internal resistance across formation/aging/grading stages).
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

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}