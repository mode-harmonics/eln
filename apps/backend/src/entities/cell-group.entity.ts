import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * cellGroup — 电池分组定义表
 * 项目级别，一台项目下的所有实验共享分组配置。
 * matchMode: 'prefix' — 按电芯名称前缀自动匹配; 'manual' — 手动指定电芯
 */
@Entity('cellGroup', { comment: '电池分组定义表' })
export class CellGroup {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> projects.id */
  @Index()
  @Column({ name: 'projectId', type: 'uuid', comment: '项目ID' })
  projectId!: string;

  @Column({ type: 'varchar', length: 64, comment: '分组名称（如 "方案A", "对照组"）' })
  name!: string;

  @Column({ type: 'varchar', length: 9, comment: '十六进制色值（如 "#1d74f5"）' })
  color!: string;

  @Column({ name: 'sortOrder', type: 'int', default: 0, comment: '排序权重' })
  sortOrder!: number;

  @Column({ name: 'matchMode', type: 'varchar', length: 16, comment: '匹配模式: prefix | manual' })
  matchMode!: string;

  @Column({ name: 'matchValue', type: 'varchar', length: 128, nullable: true, comment: '前缀模式下存前缀值; manual 模式下为空' })
  matchValue!: string | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
