import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { Project } from '../entities/project.entity';
import { PickedCell } from '../entities/picked-cell.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ExperimentsService } from '../experiments/experiments.service';
import {
  StepStatus,
  WorkflowStatus,
  BuiltInStep,
  WorkflowStepTreeDto,
  WorkflowStepNodeDto,
  parseGraphToStepTree,
  deriveWorkflowGraphMeta,
  STEP_ASSAY_MAP,
  type WorkflowGraphMeta,
} from '@eln/shared';

export function isTerminalStepStatus(status: string): boolean {
  return status === StepStatus.Completed || status === StepStatus.Skipped;
}

/**
 * A step assignment enriched with derived group/child info.
 * `isParallelGroup` / `parentStepName` / `groupType` are computed from the
 * workflow template graph at read time (see decorateSteps) — never persisted.
 */
export type WorkflowStepView = WorkflowStepAssignment & {
  /** true if this step is a group (has child steps) — regardless of serial/parallel */
  isParallelGroup: boolean;
  /** parent group step name, or null for top-level steps */
  parentStepName: string | null;
  /** group execution type; only meaningful when isParallelGroup is true */
  groupType: 'serial' | 'parallel' | null;
};

/**
 * Topological sort on a DAG defined by nodes + edges.
 * Returns node ids in dependency order. Throws on cycle.
 */
function topologicalSort(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string }>,
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    adjacency.get(e.from)!.push(e.to);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  if (result.length !== nodeIds.size) {
    throw new BadRequestException('Workflow template contains a cycle');
  }
  return result;
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
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => ExperimentsService))
    private readonly experimentsService: ExperimentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Step → assayType / label maps are defined once in @eln/shared
  // (STEP_ASSAY_MAP / STEP_NAME_MAP) and imported above.

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
    steps: any;
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
      steps: any;
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
   * The template stores steps as a DAG: { nodes: [{id,label,builtInStep}], edges: [{from,to}] }.
   * - Edges define execution order (topological sort).
   * - A node with out-degree > 1 is a parallel group (fan-out).
   * - A node whose sole parent has out-degree > 1 is a parallel child.
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

    const graph = template.steps as any;
    const nodes: Array<{ id: string; label: string; builtInStep?: string; parentId?: string }> =
      graph.nodes || [];
    const edges: Array<{ from: string; to: string }> = graph.edges || [];

    // Graph hierarchy meta — derived from the template graph (single source of truth)
    const meta = deriveWorkflowGraphMeta(graph);

    // Compute in-degree per node
    const inDegree = new Map<string, string[]>();
    for (const n of nodes) inDegree.set(n.id, []);
    for (const e of edges) {
      if (!inDegree.has(e.to)) continue;
      const ins = inDegree.get(e.to) || [];
      ins.push(e.from);
      inDegree.set(e.to, ins);
    }

    // Topological sort gives execution order
    const order = topologicalSort(nodes, edges);

    // Build assignment map + builtInStep reverse lookup
    const assignMap = new Map(dto.assignments.map((a) => [a.stepName, a]));
    const bsToName = new Map<string, string>();
    for (const n of nodes) bsToName.set(n.builtInStep || n.id, n.id);

    // Auto-assign battery_selection from experiment_design (driven by builtInStep)
    const expDesignName = bsToName.get(BuiltInStep.ExperimentDesign);
    const bsName = bsToName.get(BuiltInStep.BatterySelection);
    if (expDesignName && bsName) {
      const expDesign = assignMap.get(expDesignName);
      if (expDesign && !assignMap.has(bsName)) {
        assignMap.set(bsName, {
          stepName: bsName,
          assignedUserId: expDesign.assignedUserId,
          canViewOtherSteps: expDesign.canViewOtherSteps,
          canViewInternalCode: expDesign.canViewInternalCode,
          visibleToUserIds: expDesign.visibleToUserIds,
        });
      }
    }

    // Create instance
    const instance = this.instanceRepo.create({
      id: uuid(),
      projectId: dto.projectId,
      templateId: template.id,
      status: WorkflowStatus.Active,
      currentStepIndex: 0,
    });
    const savedInstance = await this.instanceRepo.save(instance);

    // Build flattened assignment records. Group/child relationships are NOT
    // persisted — they are derived from the template graph at read time.
    const records: WorkflowStepAssignment[] = [];
    for (let stepIndex = 0; stepIndex < order.length; stepIndex++) {
      const id = order[stepIndex];
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;

      const a = assignMap.get(id);
      records.push(this.makeRecord(
        savedInstance.id,
        stepIndex,
        id,
        a,
      ));
    }

    // First step is in_progress
    if (records.length > 0) records[0].status = StepStatus.InProgress;

    // If the first step is a group, activate its child step(s).
    // Serial groups (e.g. experiment_design → design → procurement) only
    // activate the FIRST child; parallel groups (e.g. testing) activate all.
    const firstRecord = records[0];
    const firstChildren = firstRecord ? meta.childrenOf[firstRecord.stepName] || [] : [];
    const firstGroupIsParallel = firstRecord
      ? meta.groupType[firstRecord.stepName] === 'parallel'
      : false;
    const firstToActivate = firstChildren.length > 0
      ? (firstGroupIsParallel ? firstChildren : [firstChildren[0]])
      : [];
    for (const childName of firstToActivate) {
      const child = records.find((r) => r.stepName === childName);
      if (child && child.status === StepStatus.Pending) child.status = StepStatus.InProgress;
    }

    await this.assignmentRepo.save(records);

    // Notify first assignee
    if (records[0]?.assignedUserId) {
      const firstNode = nodes.find((n) => n.id === order[0]);
      await this.notificationsService.createNotification(
        records[0].assignedUserId,
        'WORKFLOW_STEP_ASSIGNED',
        { projectId: dto.projectId, stepName: order[0], stepLabel: firstNode?.label || order[0], action: 'start' },
      );
    }

    // Notify children activated as part of a leading group
    for (const childName of firstToActivate) {
      const child = records.find((r) => r.stepName === childName);
      if (child?.status === StepStatus.InProgress && child.assignedUserId) {
        await this.notificationsService.createNotification(
          child.assignedUserId,
          'WORKFLOW_STEP_ASSIGNED',
          { projectId: dto.projectId, stepName: child.stepName, isParallel: firstGroupIsParallel },
        );
      }
    }

    await this.projectRepo.update(dto.projectId, {
      workflowInstanceId: savedInstance.id,
      workflowStatus: WorkflowStatus.Active,
    });

    return savedInstance;
  }

  private makeRecord(
    instanceId: string,
    stepIndex: number,
    stepName: string,
    assign: { assignedUserId: string; canViewOtherSteps?: boolean; canViewInternalCode?: boolean; visibleToUserIds?: string[] } | undefined,
  ): WorkflowStepAssignment {
    return this.assignmentRepo.create({
      id: uuid(),
      workflowInstanceId: instanceId,
      stepName,
      stepIndex,
      assignedUserId: assign?.assignedUserId ?? null,
      status: StepStatus.Pending,
      canViewOtherSteps: assign?.canViewOtherSteps ?? false,
      canViewInternalCode: assign?.canViewInternalCode ?? false,
      visibleToUserIds: assign?.visibleToUserIds ?? null,
      completedAt: null,
      completedBy: null,
    });
  }

  /**
   * Load the template graph for an instance and derive its hierarchy meta
   * (group membership) from the graph — the single source of truth.
   */
  private async getGraphMeta(instance: WorkflowInstance): Promise<WorkflowGraphMeta> {
    const tpl = await this.findTemplateById(instance.templateId);
    return deriveWorkflowGraphMeta((tpl.steps as any) || {});
  }

  /**
   * Attach derived group/child fields to step assignments for responses.
   * These fields are computed from the template graph, not persisted.
   */
  private decorateSteps<T extends WorkflowStepAssignment>(
    steps: T[],
    meta: WorkflowGraphMeta,
  ): WorkflowStepView[] {
    return steps.map((s) => ({
      ...s,
      isParallelGroup: !!meta.isGroup[s.stepName],
      parentStepName: meta.parentOf[s.stepName] ?? null,
      groupType: meta.groupType[s.stepName] ?? null,
    }));
  }

  // ════════════════════════════════════════════════════════════════
  //  QUERIES
  // ════════════════════════════════════════════════════════════════

  async findByProject(projectId: string, userId?: string): Promise<{
    instance: WorkflowInstance | null;
    steps: WorkflowStepView[];
  }> {
    const instance = await this.instanceRepo.findOne({ where: { projectId } });
    if (!instance) return { instance: null, steps: [] };
    let steps = await this.assignmentRepo.find({
      where: { workflowInstanceId: instance.id },
      order: { stepIndex: 'ASC' },
    });

    // Graph hierarchy meta — derived from the template graph, not persisted
    const meta = await this.getGraphMeta(instance);

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
          return { instance, steps: this.decorateSteps(enriched, meta) };
        }

        // Filter: only steps user is assigned to OR explicitly granted visibility
        // Group nodes are kept so the frontend can render the group container.
        const allowed = new Set([...userAssignmentNames, ...visibleByPerm]);
        steps = steps.filter(
          (s) => allowed.has(s.stepName) || !!meta.isGroup[s.stepName],
        );
      }
    }

    // Enrich steps with user display names
    steps = await this.enrichSteps(steps);

    return { instance, steps: this.decorateSteps(steps, meta) };
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

    if (instance.status === WorkflowStatus.Completed) {
      throw new ForbiddenException('整个流程已结束，不可修改数据');
    }

    const step = steps.find((s) => s.stepName === stepName);
    if (step && step.status === StepStatus.Completed) {
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
  ): Promise<{ instance: WorkflowInstance; steps: WorkflowStepView[] }> {
    const { instance, steps } = await this.findByProject(projectId);
    if (!instance) throw new NotFoundException('Workflow instance not found');
    if (instance.status === WorkflowStatus.Completed) {
      throw new BadRequestException('Workflow already completed');
    }

    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    // Find the user's active leaf step
    let currentStep = steps.find(
      (s) => s.status === StepStatus.InProgress && s.assignedUserId === userId && !s.isParallelGroup,
    );

    // If no active step for user, allow project creator to force-complete
    if (!currentStep && project && project.createdBy === userId) {
      currentStep = steps.find(
        (s) => s.status === StepStatus.InProgress && !s.isParallelGroup,
      );
      if (currentStep) {
        this.logger.log(`Project creator ${userId} force-completing step "${currentStep.stepName}"`);
      }
    }

    if (!currentStep) {
      const groupStep = steps.find((s) => s.status === StepStatus.InProgress && s.isParallelGroup);
      if (groupStep) {
        // If the group's children were never activated (e.g. legacy
        // instances created before child activation existed), activate them
        // so the user can complete a sub-step. Serial groups only activate
        // the first pending child; parallel groups activate all.
        const pendingChildren = steps.filter(
          (s) => s.parentStepName === groupStep.stepName && s.status === StepStatus.Pending,
        );
        if (pendingChildren.length > 0) {
          const isParallel = groupStep.groupType === 'parallel';
          const toActivate = isParallel ? pendingChildren : pendingChildren.slice(0, 1);
          for (const c of toActivate) c.status = StepStatus.InProgress;
          await this.assignmentRepo.save(toActivate);

          for (const c of toActivate) {
            if (c.assignedUserId) {
              await this.notificationsService.createNotification(
                c.assignedUserId,
                'WORKFLOW_STEP_ASSIGNED',
                { projectId, stepName: c.stepName, isParallel },
              );
            }
          }

          // Re-find the current step after activation
          currentStep = steps.find(
            (s) => s.status === StepStatus.InProgress && s.assignedUserId === userId && !s.isParallelGroup,
          );
          if (!currentStep && project && project.createdBy === userId) {
            currentStep = steps.find(
              (s) => s.status === StepStatus.InProgress && !s.isParallelGroup,
            );
          }
        }
        if (!currentStep) {
          const hint = groupStep.groupType === 'parallel'
            ? `Please complete one of the parallel sub-steps under "${groupStep.stepName}"`
            : `Please complete the next sub-step under "${groupStep.stepName}"`;
          throw new BadRequestException(hint);
        }
      } else {
        throw new BadRequestException(
          'No active step found. Either the step is not assigned to you or it is already completed.',
        );
      }
    }

    // Mark step completed
    currentStep.status = StepStatus.Completed;
    currentStep.completedAt = new Date();
    currentStep.completedBy = userId;
    await this.assignmentRepo.save(currentStep);

    this.logger.log(`Step "${currentStep.stepName}" completed by ${userId} in project ${projectId}`);

    // ── Child step completion check ──
    if (currentStep.parentStepName) {
      const parentName = currentStep.parentStepName;
      const parent = steps.find((s) => s.stepName === parentName);
      const children = steps.filter((s) => s.parentStepName === parentName);
      const isParallel = parent?.groupType === 'parallel';

      if (isParallel) {
        // Parallel group: wait until ALL siblings are terminal.
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
          return { instance, steps: await this.reloadSteps(instance) };
        }
      } else {
        // Serial group (e.g. experiment_design → design → procurement):
        // activate the NEXT pending child; only complete the group when
        // there is no child left.
        const nextChild = children.find((s) => s.status === StepStatus.Pending);
        if (nextChild) {
          nextChild.status = StepStatus.InProgress;
          await this.assignmentRepo.save(nextChild);
          this.logger.log(
            `Serial group "${parentName}": activated next child "${nextChild.stepName}"`,
          );
          if (nextChild.assignedUserId) {
            await this.notificationsService.createNotification(
              nextChild.assignedUserId,
              'WORKFLOW_STEP_ASSIGNED',
              { projectId, stepName: nextChild.stepName },
            );
          }
          return { instance, steps: await this.reloadSteps(instance) };
        }
      }

      // Group fully done → mark parent group completed
      if (parent) {
        parent.status = StepStatus.Completed;
        parent.completedAt = new Date();
        parent.completedBy = userId;
        await this.assignmentRepo.save(parent);
        this.logger.log(`Group "${parent.stepName}" fully completed`);
      }
    }

    // ── Advance to next step ──
    return this.advance(instance, steps, project);
  }

  private async advance(
    instance: WorkflowInstance,
    steps: WorkflowStepView[],
    project: Project | null,
  ): Promise<{ instance: WorkflowInstance; steps: WorkflowStepView[] }> {
    const maxCompleted = Math.max(
      ...steps.filter((s) => isTerminalStepStatus(s.status)).map((s) => s.stepIndex),
      -1,
    );
    const next = steps.find((s) => s.stepIndex > maxCompleted && s.status === StepStatus.Pending);

    if (!next) {
      // ── Workflow complete ──
      instance.status = WorkflowStatus.Completed;
      instance.currentStepIndex = maxCompleted + 1;
      await this.instanceRepo.save(instance);
      await this.projectRepo.update(instance.projectId, { workflowStatus: WorkflowStatus.Completed });

      if (project) {
        await this.notificationsService.createNotification(
          project.createdBy,
          'WORKFLOW_COMPLETED',
          { projectId: instance.projectId, projectName: project.name },
        );
        this.logger.log(`Workflow completed for project ${instance.projectId}`);
      }
      return { instance, steps: await this.reloadSteps(instance) };
    }

    // ── Activate next ──
    if (next.isParallelGroup) {
      next.status = StepStatus.InProgress;
      await this.assignmentRepo.save(next);

      // Group children to activate: parallel groups activate ALL children,
      // serial groups only the FIRST pending child.
      let children = steps.filter((s) => s.parentStepName === next.stepName && s.status === StepStatus.Pending);
      const isParallel = next.groupType === 'parallel';

      // For the testing parallel group, only activate sub-steps that have picked cells assigned
      if (isParallel && next.stepName === BuiltInStep.Testing) {
        // Query which test types actually have assigned picked cells
        const pickedCells = await this.dataSource.getRepository(PickedCell).find({
          where: { projectId: instance.projectId } as any,
        });

        // Only filter if picked cells exist — if none, activate all steps
        if (pickedCells.length > 0) {
          const activeTestTypes = new Set(pickedCells.map((pc) => pc.testType).filter(Boolean));

          for (const c of children) {
            const assayType = STEP_ASSAY_MAP[c.stepName];
            if (assayType && !activeTestTypes.has(assayType)) {
              // No cells assigned to this test — skip this sub-step entirely
              c.status = StepStatus.Skipped;
              this.logger.log(`Skipping testing sub-step "${c.stepName}": no picked cells for assayType "${assayType}"`);
            }
          }
          await this.assignmentRepo.save(children);
          // Re-filter: only keep non-skipped children for activation
          children = children.filter((c) => c.status === StepStatus.Pending);
        }
      }

      const toActivate = isParallel ? children : children.slice(0, 1);
      for (const c of toActivate) c.status = StepStatus.InProgress;
      await this.assignmentRepo.save(toActivate);

      // Auto-create experiments for activated children
      for (const c of toActivate) {
        await this.experimentsService.ensureWorkflowExperiment(instance.projectId, c.stepName);
      }

      for (const c of toActivate) {
        if (c.assignedUserId) {
          await this.notificationsService.createNotification(
            c.assignedUserId,
            'WORKFLOW_STEP_ASSIGNED',
            { projectId: instance.projectId, stepName: c.stepName, isParallel },
          );
        }
      }
    } else {
      next.status = StepStatus.InProgress;
      await this.assignmentRepo.save(next);

      // Auto-create experiment for this step
      await this.experimentsService.ensureWorkflowExperiment(instance.projectId, next.stepName);

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
    return { instance, steps: await this.reloadSteps(instance) };
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
      where: { assignedUserId: userId, status: In([StepStatus.InProgress, StepStatus.Pending]) },
      order: { stepIndex: 'ASC' },
    });
    if (!assignments.length) return [];

    const instanceIds = [...new Set(assignments.map((a) => a.workflowInstanceId))];
    const instances = await this.instanceRepo.findByIds(instanceIds);
    const projects = await this.projectRepo.findByIds(
      [...new Set(instances.map((i) => i.projectId))],
    );
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    // Group/child membership is derived from each instance's template graph
    const metaByInstance = new Map<string, WorkflowGraphMeta>();
    for (const inst of instances) {
      metaByInstance.set(inst.id, await this.getGraphMeta(inst));
    }

    return assignments
      .filter((a) => {
        const meta = metaByInstance.get(a.workflowInstanceId);
        return !meta?.isGroup[a.stepName];
      })
      .map((a) => {
        const inst = instances.find((i) => i.id === a.workflowInstanceId);
        const meta = metaByInstance.get(a.workflowInstanceId);
        const parentName = meta?.parentOf[a.stepName];
        // Only a child of a genuinely parallel group (fan-out) is "parallel";
        // serial-group children (e.g. design under experiment_design) are not.
        const isParallel = !!parentName && meta.groupType[parentName] === 'parallel';
        return {
          projectId: inst?.projectId ?? '',
          projectName: projectMap.get(inst?.projectId ?? '') ?? '',
          workflowInstanceId: a.workflowInstanceId,
          stepName: a.stepName,
          status: a.status,
          isParallel,
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
        currentStepName: steps.find((s) => s.status === StepStatus.InProgress && !s.isParallelGroup)?.stepName ?? null,
      };
    }

    return {
      canViewInternalCode: userAssignment?.canViewInternalCode ?? false,
      visibleStepNames: visibleSteps.map((s) => s.stepName),
      currentStepName: null,
    };
  }

  // ════════════════════════════════════════════════════════════════
  //  DEFAULT TEMPLATE STEPS — canonical step list for frontend
  // ════════════════════════════════════════════════════════════════

  /**
   * Converts a template DAG graph ({ nodes, edges }) into a clean, hierarchical step tree.
   */
  parseTemplateGraphToStepTree(graph: {
    nodes?: Array<{ id: string; label: string; builtInStep?: string; parentId?: string }>;
    edges?: Array<{ from: string; to: string }>;
  }): WorkflowStepTreeDto {
    return { steps: parseGraphToStepTree(graph) };
  }

  /**
   * Return the default template's hierarchical step tree definitions.
   * Single source of truth consumed by frontend dialogs and workflow UI.
   */
  async getDefaultTemplateSteps(): Promise<WorkflowStepTreeDto> {
    const tpl = await this.getDefaultTemplate();
    const graph = (tpl.steps as any) || {};
    return this.parseTemplateGraphToStepTree(graph);
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

  private async reloadSteps(instance: WorkflowInstance): Promise<WorkflowStepView[]> {
    const steps = await this.assignmentRepo.find({
      where: { workflowInstanceId: instance.id },
      order: { stepIndex: 'ASC' },
    });
    const meta = await this.getGraphMeta(instance);
    return this.decorateSteps(steps, meta);
  }
}
