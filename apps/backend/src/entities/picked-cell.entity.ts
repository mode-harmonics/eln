import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * pickedCell — 电池挑选记录表
 * Records which cells were selected (picked) for an experiment.
 * Only experiments with assayType=ProcessData have picked cells,
 * which are then synced to the other 5 target tables.
 */
@Entity('pickedCell', { comment: '电池挑选记录表' })
export class PickedCell {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯编号' })
  cellId!: string;

  /** 'auto' = system auto-pick, 'manual' = user manually selected */
  @Column({ type: 'varchar', length: 16, default: 'auto', comment: '挑选方式(auto/manual)' })
  pickedBy!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
