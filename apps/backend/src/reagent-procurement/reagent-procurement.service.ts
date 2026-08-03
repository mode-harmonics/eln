import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { WorkflowService } from '../workflow/workflow.service';

import { ExperimentDesign } from '../entities/experiment-design.entity';
import { UpdateProcurementDto } from './dto/update-procurement.dto';
import { UpdateProcurementItemDto } from './dto/batch-update-procurement.dto';

type ProcurementWithDesign = ReagentProcurement & {
  group: string;
  internalCode: string;
  isRedundancy: boolean;
  chineseName: string | null;
  cas: string;
};

@Injectable()
export class ReagentProcurementService {
  constructor(
    @InjectRepository(ReagentProcurement)
    private readonly procurementRepo: Repository<ReagentProcurement>,
    @InjectRepository(ExperimentDesign)
    private readonly designRepo: Repository<ExperimentDesign>,
    private readonly workflowService: WorkflowService,
  ) {}

  async findByProject(projectId: string): Promise<ProcurementWithDesign[]> {
    const records = await this.procurementRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    
    const designs = await this.designRepo.find({
      where: { projectId },
    });

    return records.map(r => {
      const design = designs.find(d => d.id === r.experimentDesignId);
      return {
        ...r,
        group: design?.group || '',
        internalCode: design?.internalCode || '',
        isRedundancy: design?.isRedundancy || false,
        chineseName: design?.chineseName || null,
        cas: design?.cas || '',
      };
    });
  }

  async getValidGroups(projectId: string): Promise<string[]> {
    const records = await this.procurementRepo.find({
      where: { projectId },
    });
    return records
      .filter((r) => r.isValid)
      .map((r) => {
        // Join with design to get group name
        return r.experimentDesignId;
      })
      .filter(Boolean) as string[];
  }

  async findValidGroupNames(projectId: string): Promise<string[]> {
    const records = await this.procurementRepo.find({ where: { projectId } });
    const designs = await this.designRepo.find({ where: { projectId } });
    const designMap = new Map(designs.map((d) => [d.id, d]));

    return records
      .filter((r) => r.isValid && r.experimentDesignId)
      .map((r) => designMap.get(r.experimentDesignId!)?.group)
      .filter((g): g is string => !!g);
  }

  async findInvalidInternalCodes(projectId: string): Promise<string[]> {
    const records = await this.procurementRepo.find({ where: { projectId } });
    const designs = await this.designRepo.find({ where: { projectId } });
    const designMap = new Map(designs.map((d) => [d.id, d]));

    const result = new Set<string>();
    for (const r of records) {
      if (!r.isValid && r.experimentDesignId) {
        const design = designMap.get(r.experimentDesignId);
        if (design) {
          if (design.group) result.add(design.group);
          if (design.internalCode) result.add(design.internalCode);
        }
      }
    }
    return Array.from(result);
  }


  async update(
    projectId: string,
    id: string,
    dto: UpdateProcurementDto,
  ): Promise<ReagentProcurement> {
    await this.workflowService.assertStepNotCompleted(projectId, 'procurement');

    const record = await this.procurementRepo.findOne({
      where: { id, projectId },
    });
    if (!record) throw new NotFoundException('Procurement record not found');

    Object.assign(record, dto);
    return this.procurementRepo.save(record);
  }

  /**
   * Batch update multiple procurement records in one call (批量修改).
   * All items must belong to the project; missing records fail the whole batch.
   */
  async updateBatch(
    projectId: string,
    items: UpdateProcurementItemDto[],
  ): Promise<ReagentProcurement[]> {
    if (!items || items.length === 0) return [];

    await this.workflowService.assertStepNotCompleted(projectId, 'procurement');

    const ids = items.map((i) => i.id);
    const records = await this.procurementRepo.find({
      where: { id: In(ids), projectId },
    });
    const recordMap = new Map(records.map((r) => [r.id, r]));

    const missing = ids.filter((id) => !recordMap.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Procurement records not found: ${missing.join(', ')}`,
      );
    }

    for (const item of items) {
      const record = recordMap.get(item.id)!;
      const { id, ...fields } = item;
      Object.assign(record, fields);
    }

    return this.procurementRepo.save(records);
  }
}
