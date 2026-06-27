import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * htCycle — 高温循环数据表
 * Long-cycle capacity-decay data. Source sheets use cycle number as the
 * time axis with one column per cell; this is transposed so each row is
 * one cycle, with a JSONB dict keyed by batteryId (capacity) and
 * `${batteryId}_ret` (retention %).
 *
 * Computed field (stored inside `caps` at parse time):
 *   caps[bId + "_ret"] = (cap / baseCap) * 100    容量保持率 (%)
 *   where baseCap = capacity at the first (lowest) cycle.
 *   Skipped when the source sheet already contains an explicit _ret column.
 */
@Entity('htCycle', { comment: '高温循环数据表' })
export class HtCycle {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  /** Cycle number (100, 200, ...). Primary retrieval key alongside experimentId. */
  @Index()
  @Column({ type: 'int', comment: '循环次数' })
  cycle!: number;

  /**
   * Dictionary keyed by batteryId -> capacity, and `${batteryId}_ret` ->
   * retention %, e.g. { "A001": 2.15, "A001_ret": 99.5 }.
   */
  @Column({ type: 'jsonb', comment: '容量字典数据' })
  caps!: Record<string, number>;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;
}