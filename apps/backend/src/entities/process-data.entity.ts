import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * processData — 制程数据表
 * Pre-shipment manufacturing process parameters per cell (weight, voltage,
 * internal resistance across formation/aging/grading stages).
 */
@Entity('processData')
export class ProcessData {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id (batch / run) */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  /** Cell unique code (aka batteryId in source workbooks). */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  cellId!: string;

  // --- Pre-formation weight stages ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  m0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  m1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  m2!: string | null;

  // --- Stage voltages ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  v0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  v1!: string | null;

  // --- Pre-formation voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fu0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fr0!: string | null;

  // --- Formation-stage capacity ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fq1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fq2!: string | null;

  // --- Formation mid/late voltage & internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fu1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fr1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fu2!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  fr2!: string | null;

  // --- Post electrolyte-fill / second-seal weight ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  m3!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  m4!: string | null;

  // --- Pre-grading voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gu0!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gr0!: string | null;

  // --- Grading charge/discharge capacity ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gqc1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gqd1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gqc2!: string | null;

  // --- Post-grading (shipment) voltage / internal resistance ---
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gu1!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  gr1!: string | null;

  /** Whether the cell was selected as a "good" unit (良品判定). */
  @Column({ type: 'boolean', default: false })
  picked!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}