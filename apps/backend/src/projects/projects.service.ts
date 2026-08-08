import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { deriveWorkflowGraphMeta } from '@eln/shared';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Project } from '../entities/project.entity';
import { Attachment } from '../entities/attachment.entity';
import { PickedCell } from '../entities/picked-cell.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectMembersDto } from './dto';
import { CreateExperimentDto } from '../experiments/dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Experiment) private readonly experimentsRepo: Repository<Experiment>,
    @InjectRepository(ExperimentCollaborator)
    private readonly collaboratorsRepo: Repository<ExperimentCollaborator>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findVisibleToUser(
    userId: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{ items: any[]; total?: number } | any[]> {
    const query = (await this.buildVisibleProjectsQuery(userId)).leftJoinAndSelect('project.creator', 'creator');

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(project.name) LIKE :searchPattern OR LOWER(project.description) LIKE :searchPattern)',
        { searchPattern },
      );
    }

    query.orderBy('project.createdAt', 'DESC');

    if (page !== undefined && limit !== undefined) {
      query.skip((page - 1) * limit).take(limit);
      const [items, total] = await query.getManyAndCount();
      const enrichedItems = await this.attachProgressToProjects(items);
      return { items: enrichedItems, total };
    }

    const items = await query.getMany();
    return this.attachProgressToProjects(items);
  }

  private async attachProgressToProjects(projects: Project[]): Promise<any[]> {
    if (!projects || projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);

    const instances = await this.dataSource.getRepository(WorkflowInstance).find({
      where: { projectId: In(projectIds) },
    });

    if (instances.length === 0) {
      return projects.map((p) => ({
        ...p,
        progress: { completed: 0, total: 0, percentage: 0 },
      }));
    }

    const instanceIds = instances.map((i) => i.id);
    const templateIds = [...new Set(instances.map((i) => i.templateId))];

    const [assignments, templates] = await Promise.all([
      this.dataSource.getRepository(WorkflowStepAssignment).find({
        where: { workflowInstanceId: In(instanceIds) },
        order: { stepIndex: 'ASC' },
      }),
      this.dataSource.getRepository(WorkflowTemplate).find({
        where: { id: In(templateIds) },
      }),
    ]);

    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const assignmentsByInstance = new Map<string, WorkflowStepAssignment[]>();
    for (const a of assignments) {
      if (!assignmentsByInstance.has(a.workflowInstanceId)) {
        assignmentsByInstance.set(a.workflowInstanceId, []);
      }
      assignmentsByInstance.get(a.workflowInstanceId)!.push(a);
    }

    const progressMap = new Map<string, { completed: number; total: number; percentage: number }>();

    for (const inst of instances) {
      const tpl = templateMap.get(inst.templateId);
      const graphMeta = deriveWorkflowGraphMeta((tpl?.steps as any) || {});
      const steps = assignmentsByInstance.get(inst.id) || [];

      // Filter out skipped steps
      const visibleSteps = steps.filter((s) => s.status !== 'skipped');
      // Top-level parent steps only (where parentOf is undefined/null)
      const stepParents = visibleSteps.filter((s) => !graphMeta.parentOf[s.stepName]);

      const completedCount = stepParents.filter((s) => s.status === 'completed').length;
      const totalCount = stepParents.length;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      progressMap.set(inst.projectId, {
        completed: completedCount,
        total: totalCount,
        percentage,
      });
    }

    return projects.map((p) => {
      const prog = progressMap.get(p.id) || { completed: 0, total: 0, percentage: 0 };
      return {
        ...p,
        progress: prog,
      };
    });
  }

  private async buildVisibleProjectsQuery(userId: string) {
    const collabSubQuery = this.projectsRepo.manager
      .createQueryBuilder(Experiment, 'experiment')
      .select('experiment.projectId')
      .innerJoin(ExperimentCollaborator, 'collaborator', 'collaborator.experimentId = experiment.id')
      .where('collaborator.userId = :userId');

    // Sub-query: workflow instances where user is assigned a step
    const wfAssignedSubQuery = this.projectsRepo.manager
      .createQueryBuilder(WorkflowInstance, 'wi')
      .select('wi.projectId')
      .innerJoin(WorkflowStepAssignment, 'wsa', 'wsa.workflowInstanceId = wi.id')
      .where('wsa.assignedUserId = :userId');

    // Sub-query: workflow instances where user is in visibleToUserIds of any step
    // (raw SQL because TypeORM chokes on JSONB @> operator inside .where())
    const wfVisibleRowResult = await this.projectsRepo.manager.query(
      `SELECT DISTINCT wi."projectId"
       FROM "workflowInstance" wi
       INNER JOIN "workflowStepAssignment" wsa ON wsa."workflowInstanceId" = wi.id
       WHERE wsa."visibleToUserIds" @> $1`,
      [JSON.stringify([userId])],
    );
    const wfVisibleIds = (wfVisibleRowResult as { projectId: string }[]).map((r) => r.projectId);

    const params: Record<string, unknown> = { userId };
    let visibleClause = '';
    if (wfVisibleIds.length > 0) {
      visibleClause = ` OR project.id IN (:...wfVisibleIds)`;
      params.wfVisibleIds = wfVisibleIds;
    }

    return this.projectsRepo
      .createQueryBuilder('project')
      .where(
        '(project.createdBy = :userId'
        + ' OR project.id IN (' + collabSubQuery.getQuery() + ')'
        + ' OR project.id IN (' + wfAssignedSubQuery.getQuery() + ')'
        + visibleClause
        + ')',
        params,
      );
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!project) throw new NotFoundException('Project not found.');
    // If a userId is provided, check visibility
    if (userId && !(await this.isVisibleToUser(id, userId))) {
      throw new ForbiddenException('You do not have access to this project.');
    }
    const [enriched] = await this.attachProgressToProjects([project]);
    return enriched;
  }

  /**
   * Checks whether a user can see a project (creator, collaborator, or workflow assignee).
   */
  private async isVisibleToUser(projectId: string, userId: string): Promise<boolean> {
    return (await this.buildVisibleProjectsQuery(userId))
      .andWhere('project.id = :projectId', { projectId })
      .getExists();
  }

  async findExperiments(
    projectId: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<any> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');

    if (page === undefined && limit === undefined) {
      const experiments = await this.experimentsRepo.find({
        where: { projectId },
        order: { updatedAt: 'DESC' },
      });
      return Promise.all(
        experiments.map(async (exp) => {
          const attachments = await this.dataSource.getRepository(Attachment).find({
            where: { experimentId: exp.id },
            order: { createdAt: 'ASC' },
          });
          return { ...exp, attachments };
        }),
      );
    }

    const pageNum = page ? parseInt(page as any, 10) : 1;
    const limitNum = limit ? parseInt(limit as any, 10) : 10;

    const query = this.experimentsRepo.createQueryBuilder('experiment')
      .where('experiment.projectId = :projectId', { projectId });

    if (search) {
      query.andWhere('LOWER(experiment.title) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    query.orderBy('experiment.updatedAt', 'DESC');

    const skip = (pageNum - 1) * limitNum;
    query.skip(skip).take(limitNum);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async getStats(projectId: string): Promise<{ hasPickedCells: boolean }> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');

    const count = await this.dataSource
      .getRepository(PickedCell)
      .count({ where: { projectId } } as any);

    return { hasPickedCells: count > 0 };
  }


  async create(userId: string, dto: CreateProjectDto): Promise<Project> {

    const project = this.projectsRepo.create({
      id: uuid(),
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? 'Active',
      createdBy: userId,
    });

    return this.projectsRepo.save(project);
  }

  /**
   * Creates a new experiment under the given project.
   * assayType is persisted in metadata so the Excel upload parser
   * can work independently of any enforced column.
   */
  async createExperiment(projectId: string, userId: string, dto: CreateExperimentDto): Promise<Experiment> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');

    const experiment = this.experimentsRepo.create({
      id: uuid(),
      projectId,
      title: dto.title,
      content: null,
      status: 'Draft',
      metadata: dto.assayType ? { assayType: dto.assayType, workflowStepName: dto.workflowStepName } : null,
      workflowStepName: dto.workflowStepName ?? null,
      aiAnalysisOutput: null,
      versionNo: 1,
      createdBy: userId,
    });

    const saved = await this.experimentsRepo.save(experiment);

    return saved;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projectsRepo.findOne({ where: { id }, relations: ['creator'] });
    if (!project) throw new NotFoundException('Project not found.');

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;

    return this.projectsRepo.save(project);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const project = await this.projectsRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    await this.projectsRepo.remove(project);
    return { deleted: true };
  }

  /**
   * Bulk UPSERTs experimentCollaborators for every experiment that belongs
   * to this project, applying the same member/role list across all of them
   * (BACKEND_SPEC.md §3.2: "批量 UPSERT experimentCollaborators 分配项目内
   * 的所有实验权限").
   */
  async updateMembers(projectId: string, dto: UpdateProjectMembersDto): Promise<{ updated: number }> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const experiments = await this.experimentsRepo.find({ where: { projectId } });

    let updated = 0;

    for (const experiment of experiments) {
      for (const member of dto.members) {
        const existing = await this.collaboratorsRepo.findOne({
          where: { experimentId: experiment.id, userId: member.userId },
        });

        if (existing) {
          existing.role = member.role;
          await this.collaboratorsRepo.save(existing);
        } else {
          await this.collaboratorsRepo.save(
            this.collaboratorsRepo.create({
              id: uuid(),
              experimentId: experiment.id,
              userId: member.userId,
              role: member.role,
            }),
          );
        }
        updated += 1;
      }
    }

    return { updated };
  }
}