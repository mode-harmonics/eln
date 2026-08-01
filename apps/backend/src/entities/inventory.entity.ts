import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * inventory — 库存表
 */
@Entity('inventory', { comment: '库存表' })
export class Inventory {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 128, comment: '物品名称' })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: '物品类型' })
  type!: string;

  @Index()
  @Column({ name: 'lotNumber', type: 'varchar', length: 64, nullable: true, comment: '批次号' })
  lotNumber!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true, comment: '数量' })
  quantity!: string | null;

  @Column({ name: 'storageLocation', type: 'varchar', length: 128, nullable: true, comment: '储存位置' })
  storageLocation!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '纯度' })
  purity!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'In Stock', comment: '状态' })
  status!: string;

  @Column({ name: 'lastUsedAt', type: 'timestamp', nullable: true, comment: '最后使用时间' })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt', comment: '更新时间' })
  updatedAt!: Date;
}
