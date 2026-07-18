import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { Project } from '../entities/project.entity';
import { WorkflowService } from '../workflow/workflow.service';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class ExperimentDesignService {
  constructor(
    @InjectRepository(ExperimentDesign)
    private readonly designRepo: Repository<ExperimentDesign>,
    @InjectRepository(ReagentProcurement)
    private readonly procurementRepo: Repository<ReagentProcurement>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly workflowService: WorkflowService,
    private readonly groupsService: GroupsService,
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

    await this.workflowService.assertStepNotCompleted(projectId, 'experiment_design');

    // Block duplicate submission of experiment design
    const existingCount = await this.designRepo.count({ where: { projectId } });
    if (existingCount > 0) {
      throw new BadRequestException('实验设计已提交，不可重复提交整个表单。如需修改请使用行内编辑。');
    }

    if (dto.rows.some(r => !r.moleculeName || !r.moleculeName.trim())) {
      throw new BadRequestException('分子名称不可为空');
    }

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

    // Auto-generate cell groups and battery IDs based EXACTLY on ExperimentDesign rows (1-to-1)
    const existingGroups = await this.groupsService.findByProject(projectId);
    if (existingGroups.length === 0) {
      let sortOrder = 0;
      
      // We will track the current cell sequence for each group to handle multiple rows with the same group
      const groupSeq: Record<string, number> = {};

      for (const design of saved) {
        if (!design.group) continue;
        const groupName = design.group;
        
        // Ensure group exists
        let group = await this.groupsService.findByProject(projectId).then(gs => gs.find(g => g.name === groupName));
        if (!group) {
          group = await this.groupsService.create(projectId, {
            name: groupName,
            matchMode: 'prefix',
            matchValue: groupName,
            sortOrder: sortOrder++,
          });
        }

        // Generate exactly 1 cell for this design row
        groupSeq[groupName] = (groupSeq[groupName] || 0) + 1;
        const cellId = `${groupName}${String(groupSeq[groupName]).padStart(3, '0')}`;
        await this.groupsService.assignCellToGroup(group.id, cellId);
      }
    }

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
    await this.workflowService.assertStepNotCompleted(projectId, 'experiment_design');

    if (dto.moleculeName !== undefined && (!dto.moleculeName || !dto.moleculeName.trim())) {
      throw new BadRequestException('分子名称不可为空');
    }

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
