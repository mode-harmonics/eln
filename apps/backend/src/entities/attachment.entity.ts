import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * attachment — 附件表
 */
@Entity('attachment', { comment: '附件表' })
export class Attachment {
  @PrimaryColumn({ type: 'uuid', comment: '主键ID' })
  id!: string;

  @Index()
  @Column({ name: 'experimentId', type: 'uuid', comment: '实验ID' })
  experimentId!: string;

  @Column({ name: 'fileName', type: 'varchar', length: 255, comment: '文件名' })
  fileName!: string;

  @Column({ name: 'filePath', type: 'varchar', length: 512, comment: '文件路径' })
  filePath!: string;

  @Column({ name: 'fileSize', type: 'int', comment: '文件大小' })
  fileSize!: number;

  @Column({ name: 'mimeType', type: 'varchar', length: 128, comment: '媒体类型' })
  mimeType!: string;

  @Index()
  @Column({ name: 'uploadedBy', type: 'uuid', comment: '上传者ID' })
  uploadedBy!: string;

  @CreateDateColumn({ name: 'createdAt', comment: '创建时间' })
  createdAt!: Date;
}
