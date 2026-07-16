import { WorkflowStatus, StepStatus } from '../enums';

export interface WorkflowStepDefinition {
  name: string;
  label: string;
  builtInStep?: string;
  isParallel?: boolean;
  parallelChildren?: string[];
  sortOrder: number;
}

export interface WorkflowTemplateDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  steps: WorkflowStepDefinition[];
  createdAt: string;
}

export interface CreateWorkflowTemplateDto {
  name: string;
  description?: string;
  isDefault?: boolean;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepAssignmentDto {
  id: string;
  workflowInstanceId: string;
  stepName: string;
  stepIndex: number;
  assignedUserId: string | null;
  assignedUser?: { fullName: string; email: string } | null;
  status: StepStatus | string;
  canViewOtherSteps: boolean;
  canViewInternalCode: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}

export interface WorkflowInstanceDto {
  id: string;
  projectId: string;
  templateId: string;
  status: WorkflowStatus | string;
  currentStepIndex: number;
  steps: WorkflowStepAssignmentDto[];
  createdAt: string;
}

export interface CreateWorkflowInstanceDto {
  projectId: string;
  templateId?: string;
  assignments: Array<{
    stepName: string;
    assignedUserId: string;
    canViewOtherSteps?: boolean;
    canViewInternalCode?: boolean;
  }>;
}

export interface TransitionStepDto {
  projectId: string;
}

export interface UserTaskDto {
  projectId: string;
  projectName: string;
  workflowInstanceId: string;
  stepName: string;
  stepLabel: string;
  status: StepStatus | string;
}
