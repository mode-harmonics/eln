import { Type } from 'class-transformer';
import {
  IsArray,
  IsUUID,
  ArrayNotEmpty,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  CreateWorkflowInstanceDto as SharedCreateWorkflowInstanceDto,
  CreateWorkflowTemplateDto as SharedCreateWorkflowTemplateDto,
  WorkflowTemplateNode,
  WorkflowTemplateEdge,
  WorkflowTemplateGraph,
} from '@eln/shared';

export class WorkflowTemplateNodeDto implements WorkflowTemplateNode {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  builtInStep?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class WorkflowTemplateEdgeDto implements WorkflowTemplateEdge {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

export class WorkflowTemplateGraphDto implements WorkflowTemplateGraph {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateNodeDto)
  nodes!: WorkflowTemplateNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateEdgeDto)
  edges!: WorkflowTemplateEdgeDto[];
}

export class CreateWorkflowTemplateDto implements SharedCreateWorkflowTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ValidateNested()
  @Type(() => WorkflowTemplateGraphDto)
  steps!: WorkflowTemplateGraphDto;
}

export class UpdateWorkflowTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTemplateGraphDto)
  steps?: WorkflowTemplateGraphDto;
}

export class WorkflowAssignmentInputDto {
  @IsString()
  stepName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  assignedUserIds!: string[];

  @IsOptional()
  @IsBoolean()
  canViewOtherSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewInternalCode?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  visibleToUserIds?: string[];
}

export class CreateWorkflowInstanceDto implements SharedCreateWorkflowInstanceDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowAssignmentInputDto)
  assignments!: WorkflowAssignmentInputDto[];
}

export class UpdateStepAssignmentDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assignedUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  canViewOtherSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewInternalCode?: boolean;
}

export class TransitionWorkflowDto {
  @IsOptional()
  @IsString()
  expectedStepName?: string;
}
