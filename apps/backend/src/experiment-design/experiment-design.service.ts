import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class ExperimentDesignService {
  constructor(
    @InjectRepository(ExperimentDesign)
    private readonly designRepo: Repository<ExperimentDesign>,
    @InjectRepository(ReagentProcurement)
    private readonly procurementRepo: Repository<ReagentProcurement>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async findByProject(projectId: string): Promise<ExperimentDesign[]> {
    return this.designRepo.find({
      where: { projectId },
      order: { rowIndex: 'ASC' },
    });
  }

  async batchCreate(
    projectId: string,
    dto: {
      defaultCount: number;
      redundancyCount: number;
      rows: Array<{
        group: string;
        moleculeName: string;
        chineseName: string;
        molecularStructure?: string;
        cas: string;
        designPrinciple?: string;
      }>;
    },
  ): Promise<ExperimentDesign[]> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    // Delete existing designs for this project
    await this.designRepo.delete({ projectId });

    const designs: ExperimentDesign[] = [];
    let globalIndex = 0;

    // Create default rows
    for (let i = 0; i < dto.defaultCount && i < dto.rows.length; i++) {
      const row = dto.rows[i];
      const internalCode = await this.generateInternalCode(projectId, row.group, globalIndex + 1);
      designs.push(
        this.designRepo.create({
          id: uuid(),
          projectId,
          rowIndex: globalIndex++,
          group: row.group,
          moleculeName: row.moleculeName,
          chineseName: row.chineseName ?? null,
          molecularStructure: row.molecularStructure ?? null,
          cas: row.cas,
          designPrinciple: row.designPrinciple ?? null,
          internalCode,
          isRedundancy: false,
        }),
      );
    }

    // Create redundancy rows
    for (let i = 0; i < dto.redundancyCount; i++) {
      const rowIndex = i % dto.rows.length;
      const row = dto.rows[rowIndex];
      const internalCode = await this.generateInternalCode(
        projectId,
        row.group,
        globalIndex + 1,
        true,
      );
      designs.push(
        this.designRepo.create({
          id: uuid(),
          projectId,
          rowIndex: globalIndex++,
          group: row.group,
          moleculeName: row.moleculeName,
          chineseName: row.chineseName ?? null,
          molecularStructure: row.molecularStructure ?? null,
          cas: row.cas,
          designPrinciple: row.designPrinciple ?? null,
          internalCode,
          isRedundancy: true,
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
    const design = await this.designRepo.findOne({
      where: { id, projectId },
    });
    if (!design) throw new NotFoundException('Experiment design not found');

    Object.assign(design, dto);
    return this.designRepo.save(design);
  }

  async remove(projectId: string, id: string): Promise<void> {
    const design = await this.designRepo.findOne({
      where: { id, projectId },
    });
    if (!design) throw new NotFoundException('Experiment design not found');
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
