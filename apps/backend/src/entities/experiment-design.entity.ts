import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * experimentDesign — 实验设计表
 * 存储实验设计阶段的配方信息：分组、分子名称、结构图、CAS、内部代码等
 */
@Entity('experimentDesign', { comment: '实验设计表' })
export class ExperimentDesign {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'projectId', type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Column({ name: 'rowIndex', type: 'int', comment: '行序号' })
  rowIndex!: number;

  @Column({ type: 'varchar', length: 128, comment: '分组' })
  group!: string;

  @Column({ name: 'moleculeName', type: 'varchar', length: 255, comment: '分子名称' })
  moleculeName!: string;

  @Column({ name: 'chineseName', type: 'varchar', length: 128, nullable: true, comment: '中文简称' })
  chineseName!: string | null;

  @Column({ name: 'molecularStructure', type: 'text', nullable: true, comment: '分子结构图URL' })
  molecularStructure!: string | null;

  @Column({ type: 'varchar', length: 64, comment: 'CAS号' })
  cas!: string;

  @Column({ name: 'designPrinciple', type: 'text', nullable: true, comment: '设计原理' })
  designPrinciple!: string | null;

  @Column({ name: 'internalCode', type: 'varchar', length: 128, comment: '内部代码(自动生成)' })
  internalCode!: string;

  @Column({ name: 'isRedundancy', type: 'boolean', default: false, comment: '是否为冗余行' })
  isRedundancy!: boolean;

  @Column({ name: 'cellCount', type: 'int', nullable: true, comment: '该分组的正常电池数量（默认17）' })
  cellCount!: number | null;

  @Column({ name: 'redundancyCount', type: 'int', default: 0, comment: '该分组的冗余电池数量' })
  redundancyCount!: number;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
