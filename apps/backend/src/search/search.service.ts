import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';

export interface SearchResult {
  id: string;
  type: 'project' | 'experiment';
  title: string;
  description?: string;
  url: string;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    const term = `%${query}%`;

    const projects = await this.projectRepo
      .createQueryBuilder('p')
      .where('p.name ILIKE :term', { term })
      .orWhere('p.description ILIKE :term', { term })
      .limit(10)
      .getMany();

    const experiments = await this.experimentRepo
      .createQueryBuilder('e')
      .where('e.title ILIKE :term', { term })
      .orWhere('e.content ILIKE :term', { term })
      .limit(10)
      .getMany();

    const results: SearchResult[] = [
      ...projects.map(p => ({
        id: p.id,
        type: 'project' as const,
        title: p.name,
        description: p.description ?? undefined,
        url: `/projects/${p.id}`,
      })),
      ...experiments.map(e => ({
        id: e.id,
        type: 'experiment' as const,
        title: e.title,
        description: e.content?.substring(0, 100),
        url: `/projects/${e.projectId}/experiments/${e.id}`,
      })),
    ];

    return results;
  }
}
