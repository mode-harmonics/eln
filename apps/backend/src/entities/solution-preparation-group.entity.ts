import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('solutionPreparationGroup', { comment: '配液分组信息表' })
@Unique('UQ_solutionPreparationGroup_experiment_group', ['experimentId', 'groupName'])
export class SolutionPreparationGroup {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Column({ type: 'varchar', length: 128, comment: '配液组别' })
  groupName!: string;

  @Column({ type: 'text', nullable: true, comment: '配方信息' })
  formulaInfo!: string | null;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', comment: '更新时间' })
  updatedAt!: Date;
}
