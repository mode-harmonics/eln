import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from '../entities';
import { ProjectsModule } from '../projects/projects.module';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { ParserRegistry } from './parsers/parser.registry';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(Object.values(entities)),
    MulterModule.register({
      storage: undefined, // default memoryStorage
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap
    }),
    ProjectsModule,
    WorkflowModule,
  ],
  controllers: [DataController],
  providers: [DataService, ParserRegistry],
})
export class DataModule {}