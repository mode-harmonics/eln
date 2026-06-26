import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * htCycle — 高温循环数据表
 * Long-cycle capacity-decay data. Source sheets use cycle number as the
 * time axis with one column per cell; this is transposed so each row is
 * one cycle, with a JSONB dict keyed by batteryId (capacity) and
 * `${batteryId}_ret` (retention %).
 */
@Entity('htCycle')
export class HtCycle {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid' })
  experimentId!: string;

  /** Cycle number (100, 200, ...). Primary retrieval key alongside experimentId. */
  @Index()
  @Column({ type: 'int' })
  cycle!: number;

  /**
   * Dictionary keyed by batteryId -> capacity, and `${batteryId}_ret` ->
   * retention %, e.g. { "A001": 2.15, "A001_ret": 99.5 }.
   */
  @Column({ type: 'jsonb' })
  caps!: Record<string, number>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}