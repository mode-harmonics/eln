import { WorkflowStatus, StepStatus } from '../enums';

export type WorkflowStepType = 'task' | 'serial' | 'parallel';

export interface WorkflowStepNodeDto {
  id: string;
  name: string;
  label: string;
  builtInStep: string | null;
  dataType: string | null;
  type: WorkflowStepType;
  children?: WorkflowStepNodeDto[];
  sortOrder: number;
}

export interface WorkflowStepTreeDto {
  steps: WorkflowStepNodeDto[];
}

export interface WorkflowTemplateNode {
  id: string;
  label: string;
  builtInStep?: string;
  /** Parent id for hierarchy nesting. Omitted = top-level step. */
  parentId?: string;
}

export interface WorkflowTemplateEdge {
  from: string;
  to: string;
}

export interface WorkflowTemplateGraph {
  nodes: WorkflowTemplateNode[];
  edges: WorkflowTemplateEdge[];
}

export interface WorkflowTemplateDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  steps: WorkflowTemplateGraph;
  createdAt: string;
}

export interface CreateWorkflowTemplateDto {
  name: string;
  description?: string;
  isDefault?: boolean;
  steps: WorkflowTemplateGraph;
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
    visibleToUserIds?: string[];
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
