import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Experiment } from '../entities/experiment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Project } from '../entities/project.entity';
import { CreateProjectDto, UpdateProjectMembersDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Experiment) private readonly experimentsRepo: Repository<Experiment>,
    @InjectRepository(ExperimentCollaborator)
    private readonly collaboratorsRepo: Repository<ExperimentCollaborator>,
  ) {}

  /**
   * Returns projects visible to the user: ones they created, or ones where
   * they collaborate on at least one experiment within the project.
   */
  async findVisibleToUser(userId: string): Promise<Project[]> {
    const ownedQuery = this.projectsRepo
      .createQueryBuilder('project')
      .where('project.createdBy = :userId', { userId });

    const collaboratingQuery = this.projectsRepo
      .createQueryBuilder('project')
      .innerJoin(Experiment, 'experiment', 'experiment.projectId = project.id')
      .innerJoin(
        ExperimentCollaborator,
        'collaborator',
        'collaborator.experimentId = experiment.id AND collaborator.userId = :userId',
        { userId },
      );

    const [owned, collaborating] = await Promise.all([
      ownedQuery.getMany(),
      collaboratingQuery.getMany(),
    ]);

    const byId = new Map<string, Project>();
    for (const p of [...owned, ...collaborating]) {
      byId.set(p.id, p);
    }

    return Array.from(byId.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  async findExperiments(projectId: string): Promise<Experiment[]> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');
    return this.experimentsRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
    });
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