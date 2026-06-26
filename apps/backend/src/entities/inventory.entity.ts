import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('inventory')
export class InventoryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ name: 'lotNumber', type: 'varchar', length: 64, nullable: true })
  lotNumber: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  quantity: string | null;

  @Column({ name: 'storageLocation', type: 'varchar', length: 128, nullable: true })
  storageLocation: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  purity: string | null;

  @Column({ type: 'varchar', length: 32, default: 'In Stock' })
  status: string;

  @Column({ name: 'lastUsedAt', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
