import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { WorkflowService } from '../workflow/workflow.service';

import { ExperimentDesign } from '../entities/experiment-design.entity';
import { UpdateProcurementDto } from './dto/update-procurement.dto';

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
}
