import { ProjectStatus, RoleName } from '../enums';

export interface ProjectProgressDto {
  completed: number;
  total: number;
  percentage: number;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus | string;
  workflowStatus: string | null;
  defaultCellCount: number;
  createdBy: string;
  createdAt: string;
  creator?: {
    fullName: string;
    email: string;
  };
  progress?: ProjectProgressDto;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  status?: ProjectStatus | string;
}

export interface UpdateProjectMembersDto {
  members: Array<{
    userId: string;
    role: RoleName | string;
  }>;
}

export interface PaginatedProjectsDto {
  items: ProjectDto[];
  total: number;
}