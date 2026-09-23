import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { Project } from '../entities/project.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { BuiltInStep } from '@eln/shared';
import { ProcessData } from '../entities/process-data.entity';

@Injectable()
export class ExperimentDesignService {
  private manager?: EntityManager;
  constructor(
    @InjectRepository(ExperimentDesign)
    private readonly designRepo: Repository<ExperimentDesign>,
    @InjectRepository(ReagentProcurement)
    private readonly procurementRepo: Repository<ReagentProcurement>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly workflowService: WorkflowService,
  ) {}

  private transactional<T>(work: (service: ExperimentDesignService) => Promise<T>): Promise<T> {
    return this.projectRepo.manager.transaction(async (manager) => {
      const service = new ExperimentDesignService(manager.getRepository(ExperimentDesign), manager.getRepository(ReagentProcurement), manager.getRepository(Project), this.workflowService);
      service.manager = manager;
      return work(service);
    });
  }

  private async lockProject(projectId: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id: projectId }, lock: { mode: 'pessimistic_write' } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workflowService.assertStepNotCompleted(projectId, BuiltInStep.ExperimentDesign, this.manager);
    await this.workflowService.assertStepNotCompleted(projectId, BuiltInStep.Design, this.manager);
  }

  async findByProject(projectId: string): Promise<ExperimentDesign[]> {
    return this.designRepo.find({
      where: { projectId },
      order: { rowIndex: 'ASC' },
    });
  }

  async batchCreate(
    projectId: string,
    dto: {
      groups: Array<{
        group: string;
        moleculeName: string;
        chineseName: string;
        molecularStructure?: string;
        cas: string;
        designPrinciple?: string;
        cellCount?: number;
        redundancyCount?: number;
      }>;
    },
  ): Promise<ExperimentDesign[]> {
    if (!this.manager) return this.transactional((service) => service.batchCreate(projectId, dto));
    await this.lockProject(projectId);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    // Block duplicate submission
    const existingCount = await this.designRepo.count({ where: { projectId } });
    if (existingCount > 0) {
      throw new BadRequestException('实验设计已提交，不可重复提交整个表单。如需修改请使用行内编辑。');
    }

    if (dto.groups.some(r => !r.moleculeName || !r.moleculeName.trim())) {
      throw new BadRequestException('分子名称不可为空');
    }

    const designs: ExperimentDesign[] = [];
    let globalIndex = 0;

    for (const group of dto.groups) {
      const internalCode = await this.generateInternalCode(projectId, group.group, globalIndex + 1);
      designs.push(
        this.designRepo.create({
          id: uuid(),
          projectId,
          rowIndex: globalIndex++,
          group: group.group,
          moleculeName: group.moleculeName,
          chineseName: group.chineseName ?? null,
          molecularStructure: group.molecularStructure ?? null,
          cas: group.cas,
          designPrinciple: group.designPrinciple ?? null,
          internalCode,
          cellCount: group.cellCount ?? 17,
          redundancyCount: group.redundancyCount ?? 0,
          isRedundancy: false,
        }),
      );
    }

    const saved = await this.designRepo.save(designs);

    // Auto-generate procurement records from designs
    await this.generateProcurement(projectId, saved);

    return saved;
  }

  async update(
    projectId: string,
    id: string,
    dto: Partial<{
      group: string;
      moleculeName: string;
      chineseName: string;
      molecularStructure: string;
      cas: string;
      designPrinciple: string;
    }>,
  ): Promise<ExperimentDesign> {
    if (!this.manager) return this.transactional((service) => service.update(projectId, id, dto));
    await this.lockProject(projectId);

    if (dto.moleculeName !== undefined && (!dto.moleculeName || !dto.moleculeName.trim())) {
      throw new BadRequestException('分子名称不可为空');
    }

    const design = await this.designRepo.findOne({
      where: { id, projectId },
    });
    if (!design) throw new NotFoundException('Experiment design not found');

    Object.assign(design, dto);
    const saved = await this.designRepo.save(design);
    if (dto.moleculeName !== undefined) await this.procurementRepo.update({ projectId, experimentDesignId: id }, { moleculeName: dto.moleculeName });
    return saved;
  }

  async remove(projectId: string, id: string): Promise<void> {
    if (!this.manager) return this.transactional((service) => service.remove(projectId, id));
    await this.lockProject(projectId);
    const design = await this.designRepo.findOne({
      where: { id, projectId },
    });
    if (!design) throw new NotFoundException('Experiment design not found');
    if (await this.manager.getRepository(ProcessData).count({ where: { experimentDesignId: id } })) {
      throw new BadRequestException('Cannot delete a design already used by experimental data');
    }
    await this.procurementRepo.delete({ projectId, experimentDesignId: id });
    await this.designRepo.remove(design);
  }

  private async generateInternalCode(
    projectId: string,
    group: string,
    seq: number,
    isRedundancy = false,
  ): Promise<string> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    const projectCode = project?.name
      ? project.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 4)
          .toUpperCase()
      : 'ELN';
    const groupCode = group.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'GEN';
    const suffix = isRedundancy ? 'R' : '';
    return `${projectCode}-${groupCode}-${String(seq).padStart(3, '0')}${suffix}`;
  }

  private async generateProcurement(
    projectId: string,
    designs: ExperimentDesign[],
  ): Promise<void> {
    // Delete existing procurement for this project
    await this.procurementRepo.delete({ projectId });

    // Create one procurement record per design row so every row is editable
    const procurements = designs.map((design) =>
      this.procurementRepo.create({
        id: uuid(),
        projectId,
        experimentDesignId: design.id,
        moleculeName: design.moleculeName,
        supplier: null,
        batchNo: null,
        purity: null,
        quantity: null,
        isValid: true,
        remark: null,
      }),
    );

    await this.procurementRepo.save(procurements);
  }
}
