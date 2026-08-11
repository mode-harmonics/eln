import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('scrappedSolutionGroup', { comment: '配液分组报废记录表' })
@Unique('UQ_scrappedSolutionGroup_experiment_group', ['experimentId', 'groupName'])
export class ScrappedSolutionGroup {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 128, comment: '配液组别' })
  groupName!: string;

  @Column({ type: 'text', nullable: true, comment: '报废原因' })
  reason!: string | null;

  @Column({ type: 'uuid', comment: '报废操作人ID' })
  scrappedBy!: string;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updatedAt!: Date;
}
