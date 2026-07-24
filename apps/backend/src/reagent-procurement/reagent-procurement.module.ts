import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReagentProcurementController } from './reagent-procurement.controller';
import { ReagentProcurementService } from './reagent-procurement.service';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReagentProcurement, ExperimentDesign]),
    WorkflowModule,
  ],
  controllers: [ReagentProcurementController],
  providers: [ReagentProcurementService],
})
export class ReagentProcurementModule {}
