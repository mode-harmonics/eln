import { ProjectStatus, RoleName } from '../enums';

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus | string;
  createdBy: string;
  createdAt: string;
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