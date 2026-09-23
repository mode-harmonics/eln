import * as fs from 'fs';
import * as path from 'path';
import { ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';
import { ExperimentComment } from '../entities/experiment-comment.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { Project } from '../entities/project.entity';
import { ProcessData } from '../entities/process-data.entity';
import { CalendarLife } from '../entities/calendar-life.entity';
import { StorageSwelling } from '../entities/storage-swelling.entity';
import { EnergyEfficiency } from '../entities/energy-efficiency.entity';
import { DcrTest } from '../entities/dcr-test.entity';
import { FastCharge } from '../entities/fast-charge.entity';
import { HtCycle } from '../entities/ht-cycle.entity';
import { RawStepData } from '../entities/raw-step-data.entity';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { SolutionPreparation } from '../entities/solution-preparation.entity';
import { ScrappedSolutionGroup, SolutionPreparationGroup, User } from '../entities';
import { SubmitExperimentDto, UpdateExperimentDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ExperimentStatus, STEP_ASSAY_MAP, STEP_NAME_MAP } from '@eln/shared';

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
    @InjectRepository(WorkflowStepAssignment)
    private readonly assignmentRepo: Repository<WorkflowStepAssignment>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Auto-create an Experiment for a workflow step if one doesn't already exist.
   * Gives each workflow step its own experiment detail page, and pre-fills
   * rows for ProcessData / SolutionPreparation from the experiment design.
   * (Owned by this module so WorkflowService stays free of data-entity logic.)
   */
  async ensureWorkflowExperiment(projectId: string, stepName: string, manager?: EntityManager): Promise<void> {
    if (!manager) return this.dataSource.transaction((tx) => this.ensureWorkflowExperiment(projectId, stepName, tx));
    const project = await manager.findOne(Project, { where: { id: projectId }, lock: { mode: 'pessimistic_write' } });
    if (!project) throw new NotFoundException('Project not found.');
    const assayType = STEP_ASSAY_MAP[stepName];
    if (!assayType) return;

    // Check if an experiment already exists for this step
    const existing = await manager.getRepository(Experiment).findOne({
      where: { projectId, workflowStepName: stepName } as any,
    });
    if (existing) return;


    const stepLabel = STEP_NAME_MAP[stepName] ?? stepName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const exp = manager.getRepository(Experiment).create({
      id: uuid(),
      projectId,
      title: `${stepLabel} - ${new Date().toISOString().split('T')[0]}`,
      status: ExperimentStatus.Draft,
      metadata: { assayType, workflowStepName: stepName },
      workflowStepName: stepName,
      versionNo: 1,
      createdBy: project.createdBy,
    });
    const saved = await manager.getRepository(Experiment).save(exp);

    // ── For ProcessData steps, pre-fill rows with cell IDs from experiment design ──
    if (assayType === 'ProcessData') {
      await this.prefillProcessDataCells(projectId, saved.id, manager);
    }

    // ── For SolutionPreparation, pre-fill rows with groups from experiment design ──
    if (assayType === 'SolutionPreparation') {
      await this.prefillSolutionPreparationGroups(projectId, saved.id, manager);
    }
  }

  /**
   * Pre-fill ProcessData rows with cell IDs generated from each experiment design group.
   * Format: <Group><Seq> e.g. A001, A002, ..., A017 (cellCount) + A018, A019, A020 (redundancy)
   */
  private async prefillProcessDataCells(projectId: string, experimentId: string, manager: EntityManager): Promise<void> {
    const designs = await manager.getRepository(ExperimentDesign).find({
      where: { projectId, isRedundancy: false },
      order: { rowIndex: 'ASC' },
    });
    if (designs.length === 0) return;

    const processRepo = manager.getRepository(ProcessData);
    const rows: ProcessData[] = [];

    for (const design of designs) {
      const cellCount = design.cellCount ?? 17;
      const redundancyCount = design.redundancyCount ?? 0;
      const totalCells = cellCount + redundancyCount;

      for (let i = 1; i <= totalCells; i++) {
        const cellId = `${design.group}${String(i).padStart(3, '0')}`;
        rows.push(
          processRepo.create({
            id: uuid(),
            experimentId,
            cellId,
          }),
        );
      }
    }

    if (rows.length > 0) await processRepo.save(rows);
  }

  /**
   * Pre-fill SolutionPreparation rows with groups from experiment design.
   * Each experiment design group → one empty row (配方A, 配方B...).
   * Users can then add more material rows per formula.
   */
  private async prefillSolutionPreparationGroups(projectId: string, experimentId: string, manager: EntityManager): Promise<void> {
    const designs = await manager.getRepository(ExperimentDesign).find({
      where: { projectId, isRedundancy: false },
      order: { rowIndex: 'ASC' },
    });
    if (designs.length === 0) return;

    const solutionRepo = manager.getRepository(SolutionPreparation);
    const rows: SolutionPreparation[] = [];

    // Get unique groups (may have multiple design rows per group)
    const seenGroups = new Set<string>();
    for (const design of designs) {
      if (seenGroups.has(design.group)) continue;
      seenGroups.add(design.group);

      rows.push(
        solutionRepo.create({
          id: uuid(),
          experimentId,
          groupName: design.group,
          materialName: '',
          specification: null,
          formulaAmount: null,
          actualAmount: null,
        }),
      );
    }

    if (rows.length > 0) await solutionRepo.save(rows);
  }

  async findDetail(id: string, userId?: string, permissionList?: string[]): Promise<ExperimentDetail> {
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
    return this.dataSource.transaction(async (manager) => {
      const experiment = await this.lockedDraft(manager, id);

      if (experiment.versionNo !== dto.versionNo) {
        throw new ConflictException(
          `Stale versionNo: expected ${experiment.versionNo}, received ${dto.versionNo}. Reload and retry.`,
        );
      }

      if (dto.title !== undefined) experiment.title = dto.title;
      if (dto.content !== undefined) experiment.content = dto.content;
      if (dto.metadata !== undefined) experiment.metadata = dto.metadata;

      experiment.versionNo += 1;

      const saved = await manager.save(Experiment, experiment);

      await manager.save(VersionHistory, manager.create(VersionHistory, {
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: dto.changeSummary ?? null,
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }));

      return saved;
    });
  }

  /** Only empty drafts may be discarded; preserve scientific and audit records. */
  async remove(id: string): Promise<{ success: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const experiment = await this.lockExperiment(manager, id);
      if (!experiment) throw new NotFoundException('Experiment not found.');
      if (experiment.status !== ExperimentStatus.Draft || experiment.content || experiment.aiAnalysisOutput) {
        throw new ConflictException('Only empty draft experiments can be deleted.');
      }
      const dependents = [Attachment, VersionHistory, ExperimentComment, ProcessData, CalendarLife,
        RawStepData, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle,
        SolutionPreparation, SolutionPreparationGroup, ScrappedSolutionGroup];
      for (const entity of dependents) {
        if (await manager.getRepository(entity).count({ where: { experimentId: id } })) {
          throw new ConflictException('Experiment contains data or history and cannot be deleted.');
        }
      }
      await manager.delete(ExperimentCollaborator, { experimentId: id });
      await manager.remove(Experiment, experiment);
      return { success: true };
    });
  }

  private async transition(id: string, userId: string, from: string, to: string,
    summary: string, apply?: (experiment: Experiment, manager: EntityManager) => void | Promise<void>): Promise<Experiment> {
    return this.dataSource.transaction(async (manager) => {
      const experiment = await this.lockExperiment(manager, id);
      if (!experiment) throw new NotFoundException('Experiment not found.');
      if (experiment.status !== from) throw new ConflictException(`Cannot transition experiment in status: ${experiment.status}`);
      await apply?.(experiment, manager);
      experiment.status = to;
      experiment.versionNo += 1;
      const saved = await manager.save(Experiment, experiment);
      await manager.save(VersionHistory, manager.create(VersionHistory, {
        id: uuid(), experimentId: id, versionNumber: saved.versionNo,
        changeSummary: summary, snapshot: JSON.parse(JSON.stringify(saved)), updatedBy: userId,
      }));
      return saved;
    });
  }

  async submit(id: string, userId: string, dto: SubmitExperimentDto): Promise<Experiment> {
    const saved = await this.transition(id, userId, ExperimentStatus.Draft, ExperimentStatus.InReview,
      dto.changeSummary ?? 'Submitted for review', async (experiment, manager) => {
        if (dto.reviewerId) {
          if (!await manager.findOne(User, { where: { id: dto.reviewerId, isActive: true } })) throw new NotFoundException('Active reviewer not found.');
          experiment.reviewerId = dto.reviewerId;
        }
      });
    if (saved.reviewerId) await this.notificationsService.createNotification(saved.reviewerId,
      'REVIEW_SUBMITTED', { experimentTitle: saved.title, projectId: saved.projectId }, saved.id).catch(() => undefined);
    return saved;
  }

  async approve(id: string, userId: string, comment?: string): Promise<Experiment> {
    const saved = await this.transition(id, userId, ExperimentStatus.InReview, ExperimentStatus.Approved,
      'Experiment approved', (experiment) => {
        experiment.reviewComment = comment ?? null;
        experiment.reviewedAt = new Date();
      });
    await this.notificationsService.createNotification(saved.createdBy, 'REVIEW_APPROVED',
      { experimentTitle: saved.title, projectId: saved.projectId }, saved.id).catch(() => undefined);
    return saved;
  }

  async reject(id: string, userId: string, reason: string): Promise<Experiment> {
    const saved = await this.transition(id, userId, ExperimentStatus.InReview, ExperimentStatus.Draft,
      `Rejected: ${reason}`, (experiment) => {
        experiment.reviewComment = reason;
        experiment.reviewedAt = new Date();
      });
    await this.notificationsService.createNotification(saved.createdBy, 'REVIEW_REJECTED',
      { experimentTitle: saved.title, reason, projectId: saved.projectId }, saved.id).catch(() => undefined);
    return saved;
  }

  async archive(id: string, userId: string): Promise<Experiment> {
    return this.transition(id, userId, ExperimentStatus.Approved, ExperimentStatus.Archived, 'Experiment archived');
  }

  async getCollaborators(id: string): Promise<ExperimentCollaborator[]> {
    return this.collaboratorsRepo.find({ where: { experimentId: id } });
  }

  async addCollaborator(id: string, userId: string, role: string): Promise<ExperimentCollaborator> {
    return this.dataSource.transaction(async (manager) => {
      const experiment = await this.lockExperiment(manager, id);
      if (!experiment) throw new NotFoundException('Experiment not found.');
      const user = await manager.findOne(User, { where: { id: userId, isActive: true } });
      if (!user) throw new NotFoundException('Active collaborator user not found.');
      const repo = manager.getRepository(ExperimentCollaborator);
      const collab = await repo.findOne({ where: { experimentId: id, userId } });
      return repo.save(collab ? { ...collab, role } : repo.create({ id: uuid(), experimentId: id, userId, role }));
    });
  }

  async removeCollaborator(id: string, userId: string): Promise<void> {
    await this.collaboratorsRepo.delete({ experimentId: id, userId });
  }

  // --- Attachments ---

  private async lockExperiment(manager: EntityManager, id: string): Promise<Experiment> {
    const current = await manager.findOne(Experiment, { where: { id } });
    if (!current) throw new NotFoundException('Experiment not found.');
    // Same lock order as workflow/data mutations: project, then experiment.
    // Completion cannot race a final draft edit or attachment write.
    const project = await manager.findOne(Project, { where: { id: current.projectId }, lock: { mode: 'pessimistic_write' } });
    if (!project) throw new NotFoundException('Project not found.');
    const experiment = await manager.findOne(Experiment, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!experiment) throw new NotFoundException('Experiment not found.');
    return experiment;
  }

  private async lockedDraft(manager: EntityManager, experimentId: string): Promise<Experiment> {
    const experiment = await this.lockExperiment(manager, experimentId);
    if (!experiment) throw new NotFoundException('Experiment not found.');
    if (experiment.status !== ExperimentStatus.Draft) throw new ConflictException('Only draft experiments can be edited.');
    if (experiment.workflowStepName) {
      await this.workflowService.assertStepNotCompleted(experiment.projectId, experiment.workflowStepName, manager);
    }
    return experiment;
  }

  async uploadAttachment(experimentId: string, userId: string, file: Express.Multer.File): Promise<Attachment> {
    let filePath: string | undefined;
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.lockedDraft(manager, experimentId);
        const id = uuid();
        const ext = path.extname(file.originalname) || '.bin';
        const dir = path.resolve(process.env.UPLOAD_DIR || 'uploads', experimentId);
        fs.mkdirSync(dir, { recursive: true });
        filePath = path.join(dir, `${id}${ext}`);
        fs.writeFileSync(filePath, file.buffer);
        return manager.save(Attachment, manager.create(Attachment, {
          id, experimentId, fileName: file.originalname, filePath,
          fileSize: file.buffer.length, mimeType: file.mimetype, uploadedBy: userId,
        }));
      });
    } catch (error) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw error;
    }
  }

  async getAttachment(attachmentId: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepo.findOne({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async deleteAttachment(attachmentId: string): Promise<{ success: boolean }> {
    const attachment = await this.dataSource.transaction(async (manager) => {
      const attachment = await manager.findOne(Attachment, { where: { id: attachmentId } });
      if (!attachment) throw new NotFoundException('Attachment not found');
      await this.lockedDraft(manager, attachment.experimentId);
      for (const entity of [ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle, RawStepData]) {
        await manager.getRepository(entity).delete({ attachmentId });
      }
      await manager.remove(Attachment, attachment);
      return attachment;
    });
    // Database rows remain authoritative; filesystem cleanup follows commit.
    if (fs.existsSync(attachment.filePath)) fs.unlinkSync(attachment.filePath);
    return { success: true };
  }

  // --- Comments ---

  async addComment(experimentId: string, userId: string, content: string): Promise<ExperimentComment> {
    const { experiment, comment } = await this.dataSource.transaction(async (manager) => {
      const experiment = await this.lockExperiment(manager, experimentId);
      if (!experiment) throw new NotFoundException('Experiment not found.');
      const comment = await manager.save(ExperimentComment, manager.create(ExperimentComment, {
        id: uuid(), experimentId, userId, content,
      }));
      return { experiment, comment };
    });
    const collabs = await this.collaboratorsRepo.find({ where: { experimentId } });
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
        { commentPreview: content.substring(0, 50), projectId: experiment.projectId },
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
