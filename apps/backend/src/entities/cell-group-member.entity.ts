import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * cellGroupMember — 手动分组电芯表
 * 当分组 matchMode='manual' 时，通过本表记录隶属于该分组的电芯。
 * 每个 cellIdentifier 只能归属一个手动分组。
 */
@Entity('cellGroupMember', { comment: '手动分组电芯表' })
export class CellGroupMember {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  /** Logical FK -> cellGroup.id */
  @Index()
  @Column({ name: 'groupId', type: 'uuid', comment: '分组ID' })
  groupId!: string;

  @Column({ name: 'cellIdentifier', type: 'varchar', length: 128, comment: '电芯标识符（cellName 或 cellId）' })
  cellIdentifier!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
