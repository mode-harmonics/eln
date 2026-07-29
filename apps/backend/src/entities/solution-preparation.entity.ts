import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * solutionPreparation — 配液表
 * 存储干燥/注液之前的配液步骤数据，按实验设计分组组织。
 * 每个分组（配方）包含多种物料的添加记录。
 */
@Entity('solutionPreparation', { comment: '配液表' })
export class SolutionPreparation {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> experiments.id */
  @Index()
  @Column({ name: 'experimentId', type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  /** 配方名称，与实验设计的分组一一对应，如 "A", "B", "C" */
  @Index()
  @Column({ name: 'groupName', type: 'varchar', length: 128, comment: '配方名称(对应实验设计分组)' })
  groupName!: string;

  /** 物料名称 */
  @Column({ name: 'materialName', type: 'varchar', length: 255, comment: '物料名称' })
  materialName!: string;

  /** 规格/纯度，如 "AR 99.5%"、"电池级" */
  @Column({ name: 'specification', type: 'varchar', length: 255, nullable: true, comment: '规格/纯度' })
  specification!: string | null;

  /** 配方添加量(g) */
  @Column({ name: 'formulaAmount', type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '配方添加量(g)' })
  formulaAmount!: string | null;

  /** 实际添加量(g) */
  @Column({ name: 'actualAmount', type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '实际添加量(g)' })
  actualAmount!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
