import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * pickedCell — 电池挑选记录表
 * Records which cells were selected (picked) for a project.
 * Each picked cell is assigned to exactly one test type (testType).
 * syncCellsToTables uses testType to route each cell to the correct table.
 */
@Entity('pickedCell', { comment: '电池挑选记录表' })
export class PickedCell {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电芯编号' })
  cellId!: string;

  /** 'auto' = system auto-pick, 'manual' = user manually selected */
  @Column({ type: 'varchar', length: 16, default: 'auto', comment: '挑选方式(auto/manual)' })
  pickedBy!: string;

  /** Assigned test type for this cell (e.g. 'CalendarLife', 'FastCharge', etc.) */
  @Column({ name: 'testType', type: 'varchar', length: 64, nullable: true, comment: '分配的测试类型' })
  testType!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
