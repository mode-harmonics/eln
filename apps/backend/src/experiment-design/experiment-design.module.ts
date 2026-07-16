import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExperimentDesignController } from './experiment-design.controller';
import { ExperimentDesignService } from './experiment-design.service';
import { ExperimentDesign } from '../entities/experiment-design.entity';
import { ReagentProcurement } from '../entities/reagent-procurement.entity';
import { Project } from '../entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExperimentDesign, ReagentProcurement, Project]),
  ],
  controllers: [ExperimentDesignController],
  providers: [ExperimentDesignService],
  exports: [ExperimentDesignService],
})
export class ExperimentDesignModule {}
