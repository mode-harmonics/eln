import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepAssignment } from '../entities/workflow-step-assignment.entity';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExperimentsModule } from '../experiments/experiments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplate,
      WorkflowInstance,
      WorkflowStepAssignment,
      Project,
      User,
    ]),
    NotificationsModule,
    forwardRef(() => ExperimentsModule),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
