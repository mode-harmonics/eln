import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Project } from '../entities/project.entity';
import { Attachment } from '../entities/attachment.entity';
import { PickedCell } from '../entities/picked-cell.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
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
  ): Promise<{ items: Project[]; total?: number } | Project[]> {
    const query = this.buildVisibleProjectsQuery(userId).leftJoinAndSelect('project.creator', 'creator');

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
      return { items, total };
    }

    return query.getMany();
  }

  private buildVisibleProjectsQuery(userId: string) {
    const collabSubQuery = this.projectsRepo.manager
      .createQueryBuilder(Experiment, 'experiment')
      .select('experiment.projectId')
      .innerJoin(ExperimentCollaborator, 'collaborator', 'collaborator.experimentId = experiment.id')
      .where('collaborator.userId = :userId');

    // Sub-query: workflow instances where user is assigned a step
    const wfSubQuery = this.projectsRepo.manager
      .createQueryBuilder(WorkflowInstance, 'wi')
      .select('wi.projectId')
      .innerJoin(WorkflowStepAssignment, 'wsa', 'wsa.workflowInstanceId = wi.id')
      .where('wsa.assignedUserId = :userId');

    return this.projectsRepo
      .createQueryBuilder('project')
      .where(
        '(project.createdBy = :userId OR project.id IN (' + collabSubQuery.getQuery() + ') OR project.id IN (' + wfSubQuery.getQuery() + '))',
        { userId },
      );
  }

  async findOne(id: string, userId?: string): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!project) throw new NotFoundException('Project not found.');
    // If a userId is provided, check visibility
    if (userId && !(await this.isVisibleToUser(id, userId))) {
      throw new ForbiddenException('You do not have access to this project.');
    }
    return project;
  }

  /**
   * Checks whether a user can see a project (creator, collaborator, or workflow assignee).
   */
  private async isVisibleToUser(projectId: string, userId: string): Promise<boolean> {
    return this.buildVisibleProjectsQuery(userId)
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