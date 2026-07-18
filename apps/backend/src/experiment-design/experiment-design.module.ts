import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExperimentDesignController } from './experiment-design.controller';
import { ExperimentDesignService } from './experiment-design.service';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { Project } from '../entities/project.entity';

import { WorkflowModule } from '../workflow/workflow.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExperimentDesign, ReagentProcurement, Project]),
    WorkflowModule,
    GroupsModule,
  ],
  controllers: [ExperimentDesignController],
  providers: [ExperimentDesignService],
  exports: [ExperimentDesignService],
})
export class ExperimentDesignModule {}
