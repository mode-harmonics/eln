import * as fs from 'fs';
import * as path from 'path';
import { ConflictException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
  async ensureWorkflowExperiment(projectId: string, stepName: string): Promise<void> {
    const assayType = STEP_ASSAY_MAP[stepName];
    if (!assayType) return;

    // Check if an experiment already exists for this step
    const existing = await this.experimentsRepo.findOne({
      where: { projectId, workflowStepName: stepName } as any,
    });
    if (existing) return;

    const project = await this.dataSource.getRepository(Project).findOne({ where: { id: projectId } });
    if (!project) return;

    const stepLabel = STEP_NAME_MAP[stepName] ?? stepName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const exp = this.experimentsRepo.create({
      id: uuid(),
      projectId,
      title: `${stepLabel} - ${new Date().toISOString().split('T')[0]}`,
      status: ExperimentStatus.Draft,
      metadata: { assayType, workflowStepName: stepName },
      workflowStepName: stepName,
      versionNo: 1,
      createdBy: project.createdBy,
    });
    const saved = await this.experimentsRepo.save(exp);

    // ── For ProcessData steps, pre-fill rows with cell IDs from experiment design ──
    if (assayType === 'ProcessData') {
      await this.prefillProcessDataCells(projectId, saved.id);
    }

    // ── For SolutionPreparation, pre-fill rows with groups from experiment design ──
    if (assayType === 'SolutionPreparation') {
      await this.prefillSolutionPreparationGroups(projectId, saved.id);
    }
  }

  /**
   * Pre-fill ProcessData rows with cell IDs generated from each experiment design group.
   * Format: <Group><Seq> e.g. A001, A002, ..., A017 (cellCount) + A018, A019, A020 (redundancy)
   */
  private async prefillProcessDataCells(projectId: string, experimentId: string): Promise<void> {
    const designs = await this.dataSource.getRepository(ExperimentDesign).find({
      where: { projectId, isRedundancy: false },
      order: { rowIndex: 'ASC' },
    });
    if (designs.length === 0) return;

    const processRepo = this.dataSource.getRepository(ProcessData);
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
  private async prefillSolutionPreparationGroups(projectId: string, experimentId: string): Promise<void> {
    const designs = await this.dataSource.getRepository(ExperimentDesign).find({
      where: { projectId, isRedundancy: false },
      order: { rowIndex: 'ASC' },
    });
    if (designs.length === 0) return;

    const solutionRepo = this.dataSource.getRepository(SolutionPreparation);
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

  async findDetail(id: string, userId?: string): Promise<ExperimentDetail> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    // If experiment is linked to a workflow step, check user has access
    if (userId && experiment.workflowStepName) {
      await this.assertCanAccessStep(experiment.projectId, experiment.workflowStepName, userId);
    }

    const [attachments, collaborators] = await Promise.all([
      this.attachmentsRepo.find({ where: { experimentId: id } }),
      this.collaboratorsRepo.find({ where: { experimentId: id } }),
    ]);

    return { ...experiment, attachments, collaborators };
  }

  /**
   * Check if a user can view a specific workflow step's experiment.
   * Creator + assigned user + users in visibleToUserIds can access.
   */
  private async assertCanAccessStep(projectId: string, stepName: string, userId: string): Promise<void> {
    // Project creator can always access
    const project = await this.dataSource.getRepository(Project).findOne({ where: { id: projectId } });
    if (project && project.createdBy === userId) return;

    // Check workflow step assignment
    const instance = await this.instanceRepo.findOne({ where: { projectId } });
    if (!instance) return; // No workflow — allow

    const assignment = await this.assignmentRepo.findOne({
      where: { workflowInstanceId: instance.id, stepName },
    });

    if (!assignment) return; // No assignment record — allow

    // User is assigned, or has canViewOtherSteps, or is in visibleToUserIds
    const canAccess =
      assignment.assignedUserId === userId ||
      (assignment.visibleToUserIds && assignment.visibleToUserIds.includes(userId));
    // Only check for the step being specifically assigned; canViewOtherSteps is handled at the workflow level

    if (!canAccess) {
      throw new ForbiddenException('您没有权限查看此实验');
    }
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

    experiment.status = ExperimentStatus.InReview;
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

    if (experiment.status !== ExperimentStatus.InReview) {
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

    if (experiment.status !== ExperimentStatus.InReview) {
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

  async scrap(id: string, userId: string, reason?: string): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.status === 'Scrapped') {
      throw new ConflictException('Experiment is already scrapped.');
    }

    experiment.status = 'Scrapped';
    experiment.reviewComment = reason ?? null;
    experiment.reviewedAt = new Date();
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: reason ? `报废: ${reason}` : '实验已报废',
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    // Automatically advance the workflow if experiment is linked to a project
    if (saved.projectId) {
      try {
        await this.workflowService.transition(saved.projectId, userId);
      } catch (err: any) {
        // Ignore if step was already completed or no active assignment for this user
      }
    }

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
    
    // Cascade delete any parsed rows associated with this attachment
    await Promise.all([
      this.dataSource.getRepository(ProcessData).delete({ attachmentId }),
      this.dataSource.getRepository(CalendarLife).delete({ attachmentId }),
      this.dataSource.getRepository(StorageSwelling).delete({ attachmentId }),
      this.dataSource.getRepository(EnergyEfficiency).delete({ attachmentId }),
      this.dataSource.getRepository(DcrTest).delete({ attachmentId }),
      this.dataSource.getRepository(FastCharge).delete({ attachmentId }),
      this.dataSource.getRepository(HtCycle).delete({ attachmentId }),
      this.dataSource.getRepository(RawStepData).delete({ attachmentId }),
    ]);

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
