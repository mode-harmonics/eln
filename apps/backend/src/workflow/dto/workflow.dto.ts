import { Type } from 'class-transformer';
import {
  IsArray,
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
  WorkflowStepDefinition,
} from '@eln/shared';

export class WorkflowStepDefinitionDto implements WorkflowStepDefinition {
  @IsString()
  name!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  builtInStep?: string;

  @IsOptional()
  @IsBoolean()
  isParallel?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parallelChildren?: string[];

  @IsInt()
  @Min(0)
  sortOrder!: number;
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDefinitionDto)
  steps!: WorkflowStepDefinitionDto[];
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDefinitionDto)
  steps?: WorkflowStepDefinitionDto[];
}

export class WorkflowAssignmentInputDto {
  @IsString()
  stepName!: string;

  @IsString()
  assignedUserId!: string;

  @IsOptional()
  @IsBoolean()
  canViewOtherSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewInternalCode?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleToUserIds?: string[];
}

export class CreateWorkflowInstanceDto implements SharedCreateWorkflowInstanceDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowAssignmentInputDto)
  assignments!: WorkflowAssignmentInputDto[];
}

export class UpdateStepAssignmentDto {
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsBoolean()
  canViewOtherSteps?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewInternalCode?: boolean;
}