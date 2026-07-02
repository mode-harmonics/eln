import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Project } from '../entities/project.entity';
import { Experiment } from '../entities/experiment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Experiment])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
