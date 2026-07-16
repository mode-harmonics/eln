import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * reagentProcurement — 试剂采购表
 * 实验设计提交后生成，记录每种分子/试剂的采购信息
 */
@Entity('reagentProcurement', { comment: '试剂采购表' })
export class ReagentProcurement {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'projectId', type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Column({ name: 'experimentDesignId', type: 'uuid', nullable: true, comment: '关联实验设计ID' })
  experimentDesignId!: string | null;

  @Column({ name: 'moleculeName', type: 'varchar', length: 255, comment: '分子名称' })
  moleculeName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '供应商' })
  supplier!: string | null;

  @Column({ name: 'batchNo', type: 'varchar', length: 128, nullable: true, comment: '批号' })
  batchNo!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '纯度' })
  purity!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '数量' })
  quantity!: string | null;

  @Column({ name: 'isValid', type: 'boolean', default: true, comment: '是否有效(采购到)' })
  isValid!: boolean;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
