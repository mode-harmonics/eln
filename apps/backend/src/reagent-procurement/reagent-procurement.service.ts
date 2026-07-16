import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';

@Injectable()
export class ReagentProcurementService {
  constructor(
    @InjectRepository(ReagentProcurement)
    private readonly procurementRepo: Repository<ReagentProcurement>,
  ) {}

  async findByProject(projectId: string): Promise<ReagentProcurement[]> {
    return this.procurementRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async update(
    projectId: string,
    id: string,
    dto: Partial<{
      supplier: string;
      batchNo: string;
      purity: string;
      quantity: string;
      isValid: boolean;
      remark: string;
    }>,
  ): Promise<ReagentProcurement> {
    const record = await this.procurementRepo.findOne({
      where: { id, projectId },
    });
    if (!record) throw new NotFoundException('Procurement record not found');

    Object.assign(record, dto);
    return this.procurementRepo.save(record);
  }
}
