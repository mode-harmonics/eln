import * as fs from 'fs';
import * as path from 'path';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';
import { ExperimentComment } from '../entities/experiment-comment.entity';
import { SubmitExperimentDto, UpdateExperimentDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface ExperimentDetail extends Experiment {
  attachments: Attachment[];
  collaborators: ExperimentCollaborator[];
}

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectRepository(Experiment) private readonly experimentsRepo: Repository<Experiment>,
    @InjectRepository(Attachment) private readonly attachmentsRepo: Repository<Attachment>,
    @InjectRepository(ExperimentCollaborator)
    private readonly collaboratorsRepo: Repository<ExperimentCollaborator>,
    @InjectRepository(VersionHistory)
    private readonly versionHistoryRepo: Repository<VersionHistory>,
    @InjectRepository(ExperimentComment)
    private readonly commentsRepo: Repository<ExperimentComment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findDetail(id: string): Promise<ExperimentDetail> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    const [attachments, collaborators] = await Promise.all([
      this.attachmentsRepo.find({ where: { experimentId: id } }),
      this.collaboratorsRepo.find({ where: { experimentId: id } }),
    ]);

    return { ...experiment, attachments, collaborators };
  }

  /**
   * Auto-save / edit with optimistic locking: the caller must supply the
   * versionNo they last read. If it no longer matches the row in the DB,
   * someone else has saved in the meantime and we reject with 409 rather
   * than silently overwrite their change. On success we increment
   * versionNo and write a full snapshot to versionHistory.
   */
  async update(id: string, userId: string, dto: UpdateExperimentDto): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.versionNo !== dto.versionNo) {
      throw new ConflictException(
        `Stale versionNo: expected ${experiment.versionNo}, received ${dto.versionNo}. Reload and retry.`,
      );
    }

    if (dto.title !== undefined) experiment.title = dto.title;
    if (dto.content !== undefined) experiment.content = dto.content;
    if (dto.metadata !== undefined) experiment.metadata = dto.metadata;

    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: dto.changeSummary ?? null,
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    return saved;
  }

  /**
   * Delete an experiment and all associated data.
   * Removes attachments, collaborators, version history, and the experiment itself.
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    await Promise.all([
      this.attachmentsRepo.delete({ experimentId: id }),
      this.collaboratorsRepo.delete({ experimentId: id }),
      this.versionHistoryRepo.delete({ experimentId: id }),
    ]);

    await this.experimentsRepo.remove(experiment);
    return { success: true };
  }

  /**
   * Locks the experiment for review: Draft -> In Review. Also writes a
   * versionHistory snapshot so the submitted state is auditable.
   */
  async submit(id: string, userId: string, dto: SubmitExperimentDto): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.status !== 'Draft') {
      throw new ConflictException(`Cannot submit experiment in status: ${experiment.status}`);
    }

    experiment.status = 'In Review';
    if (dto.reviewerId) {
      experiment.reviewerId = dto.reviewerId;
    }
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: dto.changeSummary ?? 'Submitted for review',
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    if (saved.reviewerId) {
      await this.notificationsService.createNotification(
        saved.reviewerId,
        'REVIEW_SUBMITTED',
        { experimentTitle: saved.title },
        saved.id,
      ).catch(e => console.error(e));
    }

    return saved;
  }

  async approve(id: string, userId: string, comment?: string): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.status !== 'In Review') {
      throw new ConflictException(`Cannot approve experiment in status: ${experiment.status}`);
    }

    experiment.status = 'Approved';
    experiment.reviewComment = comment ?? null;
    experiment.reviewedAt = new Date();
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: 'Experiment approved',
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    await this.notificationsService.createNotification(
      saved.createdBy,
      'REVIEW_APPROVED',
      { experimentTitle: saved.title },
      saved.id,
    ).catch(e => console.error(e));

    return saved;
  }

  async reject(id: string, userId: string, reason: string): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.status !== 'In Review') {
      throw new ConflictException(`Cannot reject experiment in status: ${experiment.status}`);
    }

    experiment.status = 'Draft';
    experiment.reviewComment = reason;
    experiment.reviewedAt = new Date();
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: `Rejected: ${reason}`,
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    await this.notificationsService.createNotification(
      saved.createdBy,
      'REVIEW_REJECTED',
      { experimentTitle: saved.title, reason },
      saved.id,
    ).catch(e => console.error(e));

    return saved;
  }

  async archive(id: string, userId: string): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.status !== 'Approved') {
      throw new ConflictException(`Cannot archive experiment in status: ${experiment.status}`);
    }

    experiment.status = 'Archived';
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: 'Experiment archived',
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    return saved;
  }

  async getCollaborators(id: string): Promise<ExperimentCollaborator[]> {
    return this.collaboratorsRepo.find({ where: { experimentId: id } });
  }

  async addCollaborator(id: string, userId: string, role: string): Promise<ExperimentCollaborator> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) throw new NotFoundException('Experiment not found.');

    let collab = await this.collaboratorsRepo.findOne({ where: { experimentId: id, userId } });
    if (!collab) {
      collab = this.collaboratorsRepo.create({
        id: uuid(),
        experimentId: id,
        userId,
        role,
      });
      await this.collaboratorsRepo.save(collab);
    } else {
      collab.role = role;
      await this.collaboratorsRepo.save(collab);
    }
    return collab;
  }

  async removeCollaborator(id: string, userId: string): Promise<void> {
    await this.collaboratorsRepo.delete({ experimentId: id, userId });
  }

  // --- Attachments ---

  async uploadAttachment(experimentId: string, userId: string, file: Express.Multer.File): Promise<Attachment> {
    const id = uuid();
    const ext = path.extname(file.originalname) || '.bin';
    const storedName = `${id}${ext}`;
    const dir = path.resolve('uploads', experimentId);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, storedName);
    fs.writeFileSync(filePath, file.buffer);

    return this.attachmentsRepo.save(this.attachmentsRepo.create({
      id,
      experimentId,
      fileName: file.originalname,
      filePath,
      fileSize: file.buffer.length,
      mimeType: file.mimetype,
      uploadedBy: userId,
    }));
  }

  async getAttachment(attachmentId: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepo.findOne({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async deleteAttachment(attachmentId: string): Promise<{ success: boolean }> {
    const attachment = await this.attachmentsRepo.findOne({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }
    
    await this.attachmentsRepo.remove(attachment);
    return { success: true };
  }

  // --- Comments ---

  async addComment(experimentId: string, userId: string, content: string): Promise<ExperimentComment> {
    const comment = await this.commentsRepo.save(this.commentsRepo.create({
      id: uuid(),
      experimentId,
      userId,
      content,
    }));

    // Notify all other collaborators
    const collabs = await this.collaboratorsRepo.find({ where: { experimentId } });
    const experiment = await this.experimentsRepo.findOne({ where: { id: experimentId } });
    const notifyUsers = new Set<string>();
    
    if (experiment) {
      notifyUsers.add(experiment.createdBy);
      if (experiment.reviewerId) notifyUsers.add(experiment.reviewerId);
    }
    collabs.forEach(c => notifyUsers.add(c.userId));
    notifyUsers.delete(userId); // Don't notify the commenter

    for (const targetUser of Array.from(notifyUsers)) {
      await this.notificationsService.createNotification(
        targetUser,
        'NEW_COMMENT',
        { commentPreview: content.substring(0, 50) },
        experimentId,
      ).catch(err => console.error('Failed to notify:', err));
    }

    return comment;
  }

  async getComments(experimentId: string): Promise<ExperimentComment[]> {
    return this.commentsRepo.find({
      where: { experimentId },
      order: { createdAt: 'ASC' },
    });
  }

  // --- Version History ---
  async getVersions(experimentId: string) {
    return this.versionHistoryRepo.find({
      where: { experimentId },
      order: { versionNumber: 'DESC' },
    });
  }
}