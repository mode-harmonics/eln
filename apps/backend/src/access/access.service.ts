import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { hasPermission } from '@eln/shared';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { Attachment } from '../entities/attachment.entity';
import { ProcessData } from '../entities/process-data.entity';
import { SolutionPreparation } from '../entities/solution-preparation.entity';
import { CalendarLife } from '../entities/calendar-life.entity';
import { StorageSwelling } from '../entities/storage-swelling.entity';
import { EnergyEfficiency } from '../entities/energy-efficiency.entity';
import { DcrTest } from '../entities/dcr-test.entity';
import { FastCharge } from '../entities/fast-charge.entity';
import { HtCycle } from '../entities/ht-cycle.entity';
import { RawStepData } from '../entities/raw-step-data.entity';

export type AccessMode = 'read' | 'write' | 'owner' | 'review';
const DATA_ENTITIES: Record<string, any> = { process: ProcessData, solution: SolutionPreparation, calendar: CalendarLife, swelling: StorageSwelling, efficiency: EnergyEfficiency, dcr: DcrTest, fastcharge: FastCharge, htcycle: HtCycle, raw: RawStepData };

@Injectable()
export class AccessService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  assertUuid(id: unknown): asserts id is string {
    if (typeof id !== 'string' || !isUUID(id)) throw new BadRequestException('Invalid resource identifier.');
  }

  // Read only identity and membership columns. Never fetch laboratory content or credentials for ACLs.
  private async membership(projectId?: string) {
    const [projects, experiments, instances] = await Promise.all([
      this.source.getRepository(Project).find({ where: projectId ? { id: projectId } : {}, select: { id: true, createdBy: true } }),
      this.source.getRepository(Experiment).find({ where: projectId ? { projectId } : {}, select: { id: true, projectId: true, createdBy: true, workflowStepName: true, reviewerId: true } }),
      this.source.getRepository(WorkflowInstance).find({ where: projectId ? { projectId } : {}, select: { id: true, projectId: true, templateId: true } }),
    ]);
    const [collaborators, assignments] = await Promise.all([
      this.source.getRepository(ExperimentCollaborator).find({ where: projectId ? { experimentId: In(experiments.map(e => e.id)) } : {}, select: { experimentId: true, userId: true, role: true } }),
      this.source.getRepository(WorkflowStepAssignment).find({ where: projectId ? { workflowInstanceId: In(instances.map(i => i.id)) } : {}, select: { workflowInstanceId: true, stepName: true, assignedUserIds: true, visibleToUserIds: true, canViewOtherSteps: true } }),
    ]);
    return { projects, experiments, collaborators, instances, assignments };
  }

  private collaboratorCanWrite(role: string): boolean {
    return ['Owner', 'Admin', 'Editor'].includes(role);
  }

  private projectAllowed(state: Awaited<ReturnType<AccessService['membership']>>, project: Project, user: RequestUser, mode: AccessMode, includeReviewer = true): boolean {
    if (project.createdBy === user.id) return true;
    if (mode === 'owner') return false;
    const experiments = state.experiments.filter(e => e.projectId === project.id);
    if (experiments.some(e => !e.workflowStepName && e.createdBy === user.id)) return true;
    if (state.collaborators.some(c => c.userId === user.id && experiments.some(e => e.id === c.experimentId) && (mode === 'read' || this.collaboratorCanWrite(c.role)))) return true;
    const instances = new Set(state.instances.filter(i => i.projectId === project.id).map(i => i.id));
    if (state.assignments.some(a => instances.has(a.workflowInstanceId) && (a.assignedUserIds?.includes(user.id) || (mode === 'read' && a.visibleToUserIds?.includes(user.id))))) return true;
    return includeReviewer && mode === 'read' && experiments.some(e => e.reviewerId === user.id);
  }

  private experimentAllowed(state: Awaited<ReturnType<AccessService['membership']>>, experiment: Experiment, user: RequestUser, mode: AccessMode): boolean {
    const project = state.projects.find(p => p.id === experiment.projectId);
    if (!project) return false;
    if (experiment.workflowStepName && !hasPermission(user.permissionList, `workflow_step:${experiment.workflowStepName}`)) return false;
    // Review assignment grants only this record's read/review scope, not project mutation authority.
    if ((mode === 'read' || mode === 'review') && experiment.reviewerId === user.id) return true;
    if (mode === 'review' && project.createdBy !== user.id) return false;
    if (!this.projectAllowed(state, project, user, mode, false)) return false;
    if (project.createdBy === user.id || (!experiment.workflowStepName && experiment.createdBy === user.id)) return true;
    const isCollaborator = state.collaborators.some(c => c.experimentId === experiment.id && c.userId === user.id && (mode === 'read' || this.collaboratorCanWrite(c.role)));
    if (!experiment.workflowStepName) return mode === 'read' || isCollaborator;
    if (isCollaborator) return true;
    const instances = new Set(state.instances.filter(i => i.projectId === project.id).map(i => i.id));
    const assignments = state.assignments.filter(a => instances.has(a.workflowInstanceId));
    return assignments.some(a => a.stepName === experiment.workflowStepName && (a.assignedUserIds?.includes(user.id) || (mode === 'read' && a.visibleToUserIds?.includes(user.id))))
      || (mode === 'read' && assignments.some(a => a.assignedUserIds?.includes(user.id) && a.canViewOtherSteps));
  }

  async visibleScope(user: RequestUser): Promise<{ projectIds: string[]; experimentIds: string[] }> {
    if (!hasPermission(user.permissionList, 'experiments:read')) return { projectIds: [], experimentIds: [] };
    const state = await this.membership();
    return { projectIds: state.projects.filter(p => this.projectAllowed(state, p, user, 'read')).map(p => p.id), experimentIds: state.experiments.filter(e => this.experimentAllowed(state, e, user, 'read')).map(e => e.id) };
  }

  async assertProject(id: string, user: RequestUser, mode: AccessMode = 'read') {
    this.assertUuid(id);
    const state = await this.membership(id);
    const project = state.projects.find(p => p.id === id);
    if (!project) throw new NotFoundException('Project not found.');
    if (!this.projectAllowed(state, project, user, mode)) throw new ForbiddenException('You do not have access to this project.');
    return project;
  }

  async assertExperiment(id: string, user: RequestUser, mode: AccessMode = 'read') {
    this.assertUuid(id);
    const target = await this.source.getRepository(Experiment).findOne({ where: { id }, select: { id: true, projectId: true } });
    if (!target) throw new NotFoundException('Experiment not found.');
    const state = await this.membership(target.projectId);
    const experiment = state.experiments.find(e => e.id === id);
    if (!experiment) throw new NotFoundException('Experiment not found.');
    if (!this.experimentAllowed(state, experiment, user, mode)) throw new ForbiddenException('You do not have access to this experiment.');
    return experiment;
  }

  async assertStep(projectId: string, stepName: string, user: RequestUser, mode: AccessMode = 'read') {
    this.assertUuid(projectId);
    const state = await this.membership(projectId);
    const project = state.projects.find(p => p.id === projectId);
    if (!project) throw new NotFoundException('Project not found.');
    let actualStepName = stepName;
    const instance = state.instances.find(i => i.projectId === projectId);
    if (instance?.templateId) {
      const template = await this.source.getRepository(WorkflowTemplate).findOne({ where: { id: instance.templateId }, select: { steps: true } });
      const nodes = (template?.steps as { nodes?: { id: string; builtInStep?: string; parentId?: string }[] } | undefined)?.nodes ?? [];
      let candidates = nodes.filter(node => node.builtInStep === stepName || (!node.builtInStep && node.id === stepName));
      // Old templates used experiment_design as the executable leaf. A modern
      // design/procurement group must never confer its children's permissions.
      if (stepName === 'design' && candidates.length === 0 && !nodes.some(node => node.builtInStep === 'procurement' || node.id === 'procurement')) {
        candidates = nodes.filter(node => (node.builtInStep === 'experiment_design' || node.id === 'experiment_design') && !nodes.some(child => child.parentId === node.id));
      }
      if (candidates.length > 1) throw new ForbiddenException('Ambiguous workflow domain step.');
      if (candidates.length === 1) actualStepName = candidates[0].id;
    } else if (stepName === 'design') {
      const steps = state.assignments.filter(a => a.workflowInstanceId === instance?.id);
      if (!steps.some(a => a.stepName === 'design' || a.stepName === 'procurement') && steps.some(a => a.stepName === 'experiment_design')) actualStepName = 'experiment_design';
    }
    const synthetic = { id: '', projectId, workflowStepName: actualStepName } as Experiment;
    if (!this.experimentAllowed(state, synthetic, user, mode)) throw new ForbiddenException('You do not have access to this workflow step.');
  }

  async assertAttachment(experimentId: string, attachmentId: string, user: RequestUser, mode: AccessMode) {
    this.assertUuid(attachmentId);
    await this.assertExperiment(experimentId, user, mode);
    const attachment = await this.source.getRepository(Attachment).findOne({ where: { id: attachmentId } });
    if (!attachment || attachment.experimentId !== experimentId) throw new NotFoundException('Attachment not found in this experiment.');
  }

  async assertDataRows(type: string, ids: unknown[], user: RequestUser) {
    const entity = DATA_ENTITIES[type];
    if (!entity) throw new BadRequestException('Unknown data type.');
    if (!Array.isArray(ids)) throw new BadRequestException('Rows must be an array.');
    const experimentIds = new Set<string>();
    for (const id of ids) {
      this.assertUuid(id);
      const row: any = await this.source.getRepository(entity).findOne({ where: { id } });
      if (!row) throw new NotFoundException('Data row not found.');
      experimentIds.add(row.experimentId);
    }
    for (const id of experimentIds) await this.assertExperiment(id, user, 'write');
  }

  async assertAllProjectExperiments(projectId: string, user: RequestUser, mode: 'read' | 'write') {
    await this.assertProject(projectId, user, mode);
    const state = await this.membership(projectId);
    if (state.experiments.some(e => e.projectId === projectId && !this.experimentAllowed(state, e, user, mode))) throw new ForbiddenException('This operation requires access to every experiment in the project.');
  }
}
