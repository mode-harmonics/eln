import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../entities/attachment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';
import { ExperimentComment } from '../entities/experiment-comment.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';

import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experiment, Attachment, ExperimentCollaborator, VersionHistory, ExperimentComment, WorkflowStepAssignment, WorkflowInstance]),
    NotificationsModule,
    WorkflowModule,
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
})
export class ExperimentsModule {}