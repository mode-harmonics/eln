import { Column, CreateDateColumn, UpdateDateColumn, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

/**
 * scrappedCell — 电池报废记录表
 * Records which batteries (cells) have been scrapped within a project.
 * A cell is identified by its cellId (电池编号) and is project-scoped.
 * Scrapped cells are excluded from picking, charts, summaries and exports,
 * but remain visible in experiment data tables marked as 已报废.
 */
@Entity('scrappedCell', { comment: '电池报废记录表' })
@Unique('UQ_scrappedCell_project_cell', ['projectId', 'cellId'])
export class ScrappedCell {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '电池编号' })
  cellId!: string;

  @Column({ type: 'text', nullable: true, comment: '报废原因' })
  reason!: string | null;

  @Column({ name: 'scrappedBy', type: 'uuid', comment: '报废操作人ID' })
  scrappedBy!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
