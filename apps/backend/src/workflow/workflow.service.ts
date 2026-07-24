import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PickedCell } from '../entities/picked-cell.entity';
import { User } from '../entities/user.entity';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ProcessData } from '../entities/process-data.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StepStatus, type WorkflowStepDefinition } from '@eln/shared';

export function isTerminalStepStatus(status: string): boolean {
  return status === StepStatus.Completed || status === StepStatus.Skipped;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private readonly templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStepAssignment)
    private readonly assignmentRepo: Repository<WorkflowStepAssignment>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Step name → assayType mapping for auto-creating experiments
  private readonly STEP_ASSAY_MAP: Record<string, string> = {
    drying_injection: 'ProcessData',
    formation: 'ProcessData',
    second_sealing: 'ProcessData',
    capacity_grading: 'ProcessData',
    calendar_life: 'CalendarLife',
    storage_swelling: 'StorageSwelling',
    energy_efficiency: 'EnergyEfficiency',
    dcr_test: 'DcrTest',
    fast_charge: 'FastCharge',
    ht_cycle: 'HtCycle',
  };

  // Step name → Chinese label mapping for experiment titles
  private readonly STEP_LABEL_MAP: Record<string, string> = {
    experiment_design: '实验设计',
    drying_injection: '干燥/注液',
    formation: '化成',
    second_sealing: '二封',
    capacity_grading: '定容',
    battery_selection: '挑选电池',
    calendar_life: '日历寿命',
    storage_swelling: '存储胀气',
    energy_efficiency: '能量效率',
    dcr_test: 'DCR测试',
    fast_charge: '快充时间',
    ht_cycle: '高温循环',
  };

  // ════════════════════════════════════════════════════════════════
  //  TEMPLATE CRUD
  // ════════════════════════════════════════════════════════════════

  async findTemplates(isDefault?: boolean): Promise<WorkflowTemplate[]> {
    const where: any = {};
    if (isDefault !== undefined) where.isDefault = isDefault;
    return this.templateRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  async findTemplateById(id: string): Promise<WorkflowTemplate> {
    const tpl = await this.templateRepo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Workflow template not found');
    return tpl;
  }

  async createTemplate(dto: {
    name: string;
    description?: string;
    isDefault?: boolean;
    steps: WorkflowStepDefinition[];
  }): Promise<WorkflowTemplate> {
    const tpl = this.templateRepo.create({
      id: uuid(),
      name: dto.name,
      description: dto.description ?? null,
      isDefault: dto.isDefault ?? false,
      steps: dto.steps,
    });
    return this.templateRepo.save(tpl);
  }

  async updateTemplate(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      isDefault: boolean;
      steps: WorkflowStepDefinition[];
    }>,
  ): Promise<WorkflowTemplate> {
    const tpl = await this.findTemplateById(id);
    Object.assign(tpl, dto);
    return this.templateRepo.save(tpl);
  }

  async removeTemplate(id: string): Promise<void> {
    const tpl = await this.findTemplateById(id);
    if (tpl.isDefault) {
      throw new BadRequestException('Cannot delete a default template');
    }
    await this.templateRepo.remove(tpl);
  }

  // ════════════════════════════════════════════════════════════════
  //  INSTANCE LIFECYCLE
  // ════════════════════════════════════════════════════════════════

  /**
   * Create a workflow instance from a template.
   *
   * - Serial steps → sequential stepIndex
   * - Parallel groups → group node + children with sequential indices
   * - battery_selection auto-inherits from experiment_design's assignee
   */
  async createInstance(dto: {
    projectId: string;
    templateId?: string;
    assignments: Array<{
      stepName: string;
      assignedUserId: string;
      canViewOtherSteps?: boolean;
      canViewInternalCode?: boolean;
      visibleToUserIds?: string[];
    }>;
  }): Promise<WorkflowInstance> {
    const template = dto.templateId
      ? await this.findTemplateById(dto.templateId)
      : await this.getDefaultTemplate();

    const stepDefs = [...template.steps].sort((a, b) => a.sortOrder - b.sortOrder);

    // Build assignment map
    const assignMap = new Map(dto.assignments.map((a) => [a.stepName, a]));

    // Auto-assign battery_selection from experiment_design
    const expDesign = assignMap.get('experiment_design');
    if (expDesign && !assignMap.has('battery_selection')) {
      assignMap.set('battery_selection', {
        stepName: 'battery_selection',
        assignedUserId: expDesign.assignedUserId,
        canViewOtherSteps: expDesign.canViewOtherSteps,
        canViewInternalCode: expDesign.canViewInternalCode,
        visibleToUserIds: expDesign.visibleToUserIds,
      });
    }

    // Create instance
    const instance = this.instanceRepo.create({
      id: uuid(),
      projectId: dto.projectId,
      templateId: template.id,
      status: 'Active',
      currentStepIndex: 0,
    });
    const savedInstance = await this.instanceRepo.save(instance);

    // Build flattened assignment records
    let stepIndex = 0;
    const records: WorkflowStepAssignment[] = [];

    for (const def of stepDefs) {
      if (def.isParallel && def.parallelChildren?.length) {
        const a = assignMap.get(def.name);
        records.push(this.makeRecord(savedInstance.id, stepIndex++, def.name, a, true, null));
        for (const childName of def.parallelChildren) {
          const ca = assignMap.get(childName);
          records.push(this.makeRecord(savedInstance.id, stepIndex++, childName, ca, false, def.name));
        }
      } else {
        const a = assignMap.get(def.name);
        records.push(this.makeRecord(savedInstance.id, stepIndex++, def.name, a, false, null));
      }
    }

    // First step is in_progress
    if (records.length > 0) records[0].status = 'in_progress';

    await this.assignmentRepo.save(records);

    // Notify first assignee
    if (records[0]?.assignedUserId) {
      await this.notificationsService.createNotification(
        records[0].assignedUserId,
        'WORKFLOW_STEP_ASSIGNED',
        { projectId: dto.projectId, stepName: stepDefs[0].name, stepLabel: stepDefs[0].label, action: 'start' },
      );
    }

    await this.projectRepo.update(dto.projectId, {
      workflowInstanceId: savedInstance.id,
      workflowStatus: 'Active',
    });

    return savedInstance;
  }

  private makeRecord(
    instanceId: string,
    stepIndex: number,
    stepName: string,
    assign: { assignedUserId: string; canViewOtherSteps?: boolean; canViewInternalCode?: boolean; visibleToUserIds?: string[] } | undefined,
    isParallelGroup: boolean,
    parentStepName: string | null,
  ): WorkflowStepAssignment {
    return this.assignmentRepo.create({
      id: uuid(),
      workflowInstanceId: instanceId,
      stepName,
      stepIndex,
      assignedUserId: assign?.assignedUserId ?? null,
      status: 'pending',
      canViewOtherSteps: assign?.canViewOtherSteps ?? false,
      canViewInternalCode: assign?.canViewInternalCode ?? false,
      visibleToUserIds: assign?.visibleToUserIds ?? null,
      isParallelGroup,
      parentStepName,
      completedAt: null,
      completedBy: null,
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  QUERIES
  // ════════════════════════════════════════════════════════════════

  async findByProject(projectId: string, userId?: string): Promise<{
    instance: WorkflowInstance | null;
    steps: WorkflowStepAssignment[];
  }> {
    const instance = await this.instanceRepo.findOne({ where: { projectId } });
    if (!instance) return { instance: null, steps: [] };
    let steps = await this.assignmentRepo.find({
      where: { workflowInstanceId: instance.id },
      order: { stepIndex: 'ASC' },
    });

    // Filter by user visibility if userId is provided
    if (userId) {
      const project = await this.projectRepo.findOne({ where: { id: projectId } });
      const isCreator = project?.createdBy === userId;

      if (!isCreator) {
        // Get user's assignments
        const userAssignmentNames = new Set(
          steps.filter((s) => s.assignedUserId === userId).map((s) => s.stepName),
        );
        // Get user's visible steps
        const visibleByPerm = steps.filter(
          (s) => s.visibleToUserIds && s.visibleToUserIds.includes(userId),
        ).map((s) => s.stepName);
        const canSeeAll = steps.some(
          (s) => s.assignedUserId === userId && s.canViewOtherSteps,
        );

        if (canSeeAll) {
          // User can see all steps (e.g. PI/Admin role assigned)
          // Enrich before early return
          const enriched = await this.enrichSteps(steps);
          return { instance, steps: enriched };
        }

        // Filter: only steps user is assigned to OR explicitly granted visibility
        const allowed = new Set([...userAssignmentNames, ...visibleByPerm]);
        steps = steps.filter((s) => allowed.has(s.stepName) || s.isParallelGroup);
      }
    }

    // Enrich steps with user display names
    steps = await this.enrichSteps(steps);

    return { instance, steps };
  }

  /**
   * Enrich step assignments with user display names so the frontend
   * doesn't need to fetch the full users list.
   */
  private async enrichSteps(steps: WorkflowStepAssignment[]): Promise<any[]> {
    const userIds = new Set<string>();
    for (const s of steps) {
      if (s.assignedUserId) userIds.add(s.assignedUserId);
      if (s.completedBy) userIds.add(s.completedBy);
    }
    if (userIds.size === 0) return steps.map((s) => ({ ...s, assignedUserName: null, completedByName: null }));

    const users = await this.usersRepo.find({
      where: { id: In([...userIds]) },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName || u.username]));

    return steps.map((s) => ({
      ...s,
      assignedUserName: s.assignedUserId ? (nameMap.get(s.assignedUserId) ?? null) : null,
      completedByName: s.completedBy ? (nameMap.get(s.completedBy) ?? null) : null,
    }));
  }

  async getSteps(projectId: string): Promise<WorkflowStepAssignment[]> {
    const { instance, steps } = await this.findByProject(projectId);
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return steps;
  }

  /**
   * Throws ForbiddenException if the given stepName is completed in the workflow.
   */
  async assertStepNotCompleted(projectId: string, stepName: string): Promise<void> {
    const { instance, steps } = await this.findByProject(projectId);
    if (!instance) return; // No workflow instance, allow bypass

    if (instance.status === 'Completed') {
      throw new ForbiddenException('整个流程已结束，不可修改数据');
    }

    const step = steps.find((s) => s.stepName === stepName);
    if (step && step.status === 'completed') {
      throw new ForbiddenException('该步骤已提交，不可再修改数据');
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  STATE MACHINE — TRANSITION
  // ════════════════════════════════════════════════════════════════

  /**
   * Advance the workflow by completing the current step.
   *
   * Rules:
   * 1. Current step must be in_progress and assigned to userId
   * 2. Mark step completed, record timestamp + userId
   * 3. If this is a parallel child, check if ALL siblings done
   *    - No → return (wait for others)
   *    - Yes → mark parent group as completed, advance
   * 4. Find next pending step after the highest completed index
   * 5. If next is a parallel group → activate group + ALL children
   * 6. If next is serial → activate just that step
   * 7. If no next step → workflow completed → notify project creator
   */
  async transition(
    projectId: string,
    userId: string,
  ): Promise<{ instance: WorkflowInstance; steps: WorkflowStepAssignment[] }> {
    const { instance, steps } = await this.findByProject(projectId);
    if (!instance) throw new NotFoundException('Workflow instance not found');
    if (instance.status === 'Completed') {
      throw new BadRequestException('Workflow already completed');
    }

    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    // Find the user's active leaf step
    let currentStep = steps.find(
      (s) => s.status === 'in_progress' && s.assignedUserId === userId && !s.isParallelGroup,
    );

    // If no active step for user, allow project creator to force-complete
    if (!currentStep && project && project.createdBy === userId) {
      currentStep = steps.find(
        (s) => s.status === 'in_progress' && !s.isParallelGroup,
      );
      if (currentStep) {
        this.logger.log(`Project creator ${userId} force-completing step "${currentStep.stepName}"`);
      }
    }

    if (!currentStep) {
      const groupStep = steps.find((s) => s.status === 'in_progress' && s.isParallelGroup);
      if (groupStep) {
        throw new BadRequestException(
          `Please complete one of the parallel sub-steps under "${groupStep.stepName}"`,
        );
      }
      throw new BadRequestException(
        'No active step found. Either the step is not assigned to you or it is already completed.',
      );
    }

    // Mark step completed
    currentStep.status = 'completed';
    currentStep.completedAt = new Date();
    currentStep.completedBy = userId;
    await this.assignmentRepo.save(currentStep);

    this.logger.log(`Step "${currentStep.stepName}" completed by ${userId} in project ${projectId}`);

    // ── Parallel child completion check ──
    if (currentStep.parentStepName) {
      const children = steps.filter((s) => s.parentStepName === currentStep.parentStepName);
      const allDone = children.every((s) => isTerminalStepStatus(s.status));

      if (!allDone) {
        if (project) {
          await this.notificationsService.createNotification(
            project.createdBy,
            'WORKFLOW_STEP_COMPLETED',
            {
              projectId,
              projectName: project.name,
              stepName: currentStep.stepName,
              status: 'partial',
              remaining: children.filter((s) => !isTerminalStepStatus(s.status)).length,
            },
          );
        }
        return { instance, steps: await this.reloadSteps(instance.id) };
      }

      // All children done → mark parent group completed
      const parent = steps.find((s) => s.stepName === currentStep.parentStepName);
      if (parent) {
        parent.status = 'completed';
        parent.completedAt = new Date();
        parent.completedBy = userId;
        await this.assignmentRepo.save(parent);
        this.logger.log(`Parallel group "${parent.stepName}" fully completed`);
      }
    }

    // ── Advance to next step ──
    return this.advance(instance, steps, project);
  }

  private async advance(
    instance: WorkflowInstance,
    steps: WorkflowStepAssignment[],
    project: Project | null,
  ): Promise<{ instance: WorkflowInstance; steps: WorkflowStepAssignment[] }> {
    const maxCompleted = Math.max(
      ...steps.filter((s) => isTerminalStepStatus(s.status)).map((s) => s.stepIndex),
      -1,
    );
    const next = steps.find((s) => s.stepIndex > maxCompleted && s.status === 'pending');

    if (!next) {
      // ── Workflow complete ──
      instance.status = 'Completed';
      instance.currentStepIndex = maxCompleted + 1;
      await this.instanceRepo.save(instance);
      await this.projectRepo.update(instance.projectId, { workflowStatus: 'Completed' });

      if (project) {
        await this.notificationsService.createNotification(
          project.createdBy,
          'WORKFLOW_COMPLETED',
          { projectId: instance.projectId, projectName: project.name },
        );
        this.logger.log(`Workflow completed for project ${instance.projectId}`);
      }
      return { instance, steps: await this.reloadSteps(instance.id) };
    }

    // ── Activate next ──
    if (next.isParallelGroup) {
      next.status = 'in_progress';
      await this.assignmentRepo.save(next);

      // For the testing parallel group, only activate sub-steps that have picked cells assigned
      let children = steps.filter((s) => s.parentStepName === next.stepName && s.status === 'pending');

      if (next.stepName === 'testing') {
        // Query which test types actually have assigned picked cells
        const pickedCells = await this.dataSource.getRepository(PickedCell).find({
          where: { projectId: instance.projectId } as any,
        });

        // Only filter if picked cells exist — if none, activate all steps
        if (pickedCells.length > 0) {
          const activeTestTypes = new Set(pickedCells.map((pc) => pc.testType).filter(Boolean));

          for (const c of children) {
            const assayType = this.STEP_ASSAY_MAP[c.stepName];
            if (assayType && !activeTestTypes.has(assayType)) {
              // No cells assigned to this test — skip this sub-step entirely
              c.status = 'skipped';
              this.logger.log(`Skipping testing sub-step "${c.stepName}": no picked cells for assayType "${assayType}"`);
            }
          }
          await this.assignmentRepo.save(children);
          // Re-filter: only keep non-skipped children for activation
          children = children.filter((c) => c.status === 'pending');
        }
      }

      for (const c of children) c.status = 'in_progress';
      await this.assignmentRepo.save(children);

      // Auto-create experiments for parallel children
      for (const c of children) {
        await this.ensureExperiment(instance.projectId, c.stepName);
      }

      for (const c of children) {
        if (c.assignedUserId) {
          await this.notificationsService.createNotification(
            c.assignedUserId,
            'WORKFLOW_STEP_ASSIGNED',
            { projectId: instance.projectId, stepName: c.stepName, isParallel: true },
          );
        }
      }
    } else {
      next.status = 'in_progress';
      await this.assignmentRepo.save(next);

      // Auto-create experiment for this step
      await this.ensureExperiment(instance.projectId, next.stepName);

      if (next.assignedUserId) {
        await this.notificationsService.createNotification(
          next.assignedUserId,
          'WORKFLOW_STEP_ASSIGNED',
          { projectId: instance.projectId, stepName: next.stepName },
        );
      }
    }

    instance.currentStepIndex = next.stepIndex;
    await this.instanceRepo.save(instance);
    return { instance, steps: await this.reloadSteps(instance.id) };
  }

  /**
   * Auto-create an Experiment for a step if one doesn't already exist.
   * This gives each workflow step its own experiment detail page.
   */
  private async ensureExperiment(projectId: string, stepName: string): Promise<void> {
    const assayType = this.STEP_ASSAY_MAP[stepName];
    if (!assayType) return;

    // Check if an experiment already exists for this step
    const existing = await this.experimentRepo.findOne({
      where: { projectId, workflowStepName: stepName } as any,
    });
    if (existing) return;

    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return;

    const stepLabel = this.STEP_LABEL_MAP[stepName] ?? stepName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const exp = this.experimentRepo.create({
      id: uuid(),
      projectId,
      title: `${stepLabel} - ${new Date().toISOString().split('T')[0]}`,
      status: 'Draft',
      metadata: { assayType, workflowStepName: stepName },
      workflowStepName: stepName,
      versionNo: 1,
      createdBy: project.createdBy,
    });
    const saved = await this.experimentRepo.save(exp);
    this.logger.log(`Auto-created experiment "${exp.title}" for step "${stepName}"`);

    // ── For ProcessData steps, pre-fill rows with cell IDs from experiment design ──
    if (assayType === 'ProcessData') {
      await this.prefillProcessDataCells(projectId, saved.id);
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
    if (designs.length === 0) {
      this.logger.log(`No experiment designs found for project ${projectId}, skipping ProcessData pre-fill`);
      return;
    }

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

    if (rows.length > 0) {
      await processRepo.save(rows);
      this.logger.log(`Pre-filled ${rows.length} ProcessData rows for experiment ${experimentId}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  ASSIGNMENT MANAGEMENT
  // ════════════════════════════════════════════════════════════════

  async updateStepAssignment(
    projectId: string,
    stepName: string,
    dto: Partial<{
      assignedUserId: string;
      canViewOtherSteps: boolean;
      canViewInternalCode: boolean;
    }>,
  ): Promise<WorkflowStepAssignment> {
    const { instance } = await this.findByProject(projectId);
    if (!instance) throw new NotFoundException('Workflow instance not found');

    const assignment = await this.assignmentRepo.findOne({
      where: { workflowInstanceId: instance.id, stepName },
    });
    if (!assignment) throw new NotFoundException('Step assignment not found');

    Object.assign(assignment, dto);
    return this.assignmentRepo.save(assignment);
  }

  // ════════════════════════════════════════════════════════════════
  //  MY TASKS
  // ════════════════════════════════════════════════════════════════

  async getMyTasks(userId: string): Promise<
    Array<{
      projectId: string;
      projectName: string;
      workflowInstanceId: string;
      stepName: string;
      status: string;
      isParallel: boolean;
    }>
  > {
    const assignments = await this.assignmentRepo.find({
      where: { assignedUserId: userId, status: In(['in_progress', 'pending']) },
      order: { stepIndex: 'ASC' },
    });
    if (!assignments.length) return [];

    const instanceIds = [...new Set(assignments.map((a) => a.workflowInstanceId))];
    const instances = await this.instanceRepo.findByIds(instanceIds);
    const projects = await this.projectRepo.findByIds(
      [...new Set(instances.map((i) => i.projectId))],
    );
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    return assignments
      .filter((a) => !a.isParallelGroup)
      .map((a) => {
        const inst = instances.find((i) => i.id === a.workflowInstanceId);
        return {
          projectId: inst?.projectId ?? '',
          projectName: projectMap.get(inst?.projectId ?? '') ?? '',
          workflowInstanceId: a.workflowInstanceId,
          stepName: a.stepName,
          status: a.status,
          isParallel: !!a.parentStepName,
        };
      });
  }

  // ════════════════════════════════════════════════════════════════
  //  PERMISSION HELPERS
  // ════════════════════════════════════════════════════════════════

  async getUserProjectPermissions(
    projectId: string,
    userId: string,
  ): Promise<{
    canViewInternalCode: boolean;
    visibleStepNames: string[];
    currentStepName: string | null;
  }> {
    const { instance, steps } = await this.findByProject(projectId);
    if (!instance) {
      return { canViewInternalCode: false, visibleStepNames: [], currentStepName: null };
    }

    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    const isCreator = project?.createdBy === userId;
    const userAssignment = steps.find((s) => s.assignedUserId === userId);
    const visibleSteps = steps.filter((s) => s.assignedUserId === userId || (s.visibleToUserIds && s.visibleToUserIds.includes(userId)));

    if (isCreator || userAssignment?.canViewOtherSteps) {
      return {
        canViewInternalCode: isCreator || userAssignment?.canViewInternalCode || false,
        visibleStepNames: steps.map((s) => s.stepName),
        currentStepName: steps.find((s) => s.status === 'in_progress' && !s.isParallelGroup)?.stepName ?? null,
      };
    }

    return {
      canViewInternalCode: userAssignment?.canViewInternalCode ?? false,
      visibleStepNames: visibleSteps.map((s) => s.stepName),
      currentStepName: null,
    };
  }

  // ════════════════════════════════════════════════════════════════
  //  INTERNAL
  // ════════════════════════════════════════════════════════════════

  private async getDefaultTemplate(): Promise<WorkflowTemplate> {
    const [tpl] = await this.templateRepo.find({
      where: { isDefault: true },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (!tpl) throw new NotFoundException('No default workflow template found');
    return tpl;
  }

  private async reloadSteps(instanceId: string): Promise<WorkflowStepAssignment[]> {
    return this.assignmentRepo.find({
      where: { workflowInstanceId: instanceId },
      order: { stepIndex: 'ASC' },
    });
  }
}
