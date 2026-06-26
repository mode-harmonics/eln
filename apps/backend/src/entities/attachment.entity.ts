import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('attachments')
export class AttachmentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid' })
  experimentId: string;

  @Column({ name: 'fileName', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'filePath', type: 'varchar', length: 512 })
  filePath: string;

  @Column({ name: 'fileSize', type: 'int' })
  fileSize: number;

  @Column({ name: 'mimeType', type: 'varchar', length: 128 })
  mimeType: string;

  @Index()
  @Column({ name: 'uploadedBy', type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
