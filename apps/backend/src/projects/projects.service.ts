import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Project } from '../entities/project.entity';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectMembersDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Experiment) private readonly experimentsRepo: Repository<Experiment>,
    @InjectRepository(ExperimentCollaborator)
    private readonly collaboratorsRepo: Repository<ExperimentCollaborator>,
  ) {}

  async findVisibleToUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ items: Project[]; total: number }> {
    const subQuery = this.projectsRepo.manager
      .createQueryBuilder(Experiment, 'experiment')
      .select('experiment.projectId')
      .innerJoin(
        ExperimentCollaborator,
        'collaborator',
        'collaborator.experimentId = experiment.id',
      )
      .where('collaborator.userId = :userId', { userId });

    const query = this.projectsRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.creator', 'creator')
      .where(
        '(project.createdBy = :userId OR project.id IN (' + subQuery.getQuery() + '))',
        { userId },
      );

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim().toLowerCase()}%`;
      query.andWhere(
        '(LOWER(project.name) LIKE :searchPattern OR LOWER(project.description) LIKE :searchPattern)',
        { searchPattern },
      );
    }

    query
      .orderBy('project.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
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
      return this.experimentsRepo.find({
        where: { projectId },
        order: { updatedAt: 'DESC' },
      });
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