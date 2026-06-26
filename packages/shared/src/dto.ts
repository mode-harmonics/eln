/**
 * @eln/shared — request/response DTO interfaces (framework-agnostic).
 * Backend controllers use class-validator DTOs that implement these shapes;
 * the future frontend consumes these types directly.
 */
import {
  ExperimentStatus,
  InventoryStatus,
  ProjectStatus,
  RoleName,
} from './enums';

// ---- Auth ----
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatar?: string | null;
  role: RoleName;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ---- Users ----
export interface UserDto extends AuthUser {
  departmentId?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ---- Roles ----
export interface RoleDto {
  id: string;
  name: RoleName;
  permissionList: string[];
  createdAt: string;
}

// ---- Projects ----
export interface ProjectDto {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface ProjectMemberInput {
  userId: string;
  role: RoleName;
}

// ---- Experiments ----
export interface ExperimentMetadata {
  assayType?: string;
  notebookRef?: string;
  deviceUsed?: string;
  reagentLotId?: string;
  [key: string]: unknown;
}

export interface CollaboratorDto {
  id: string;
  experimentId: string;
  userId: string;
  role: RoleName;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  experimentId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface ExperimentDto {
  id: string;
  projectId: string;
  title: string;
  content?: string | null;
  status: ExperimentStatus;
  metadata: ExperimentMetadata | null;
  aiAnalysisOutput?: string | null;
  versionNo: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  collaborators?: CollaboratorDto[];
  attachments?: AttachmentDto[];
}

export interface UpdateExperimentRequest {
  title?: string;
  content?: string;
  metadata?: ExperimentMetadata;
  versionNo: number;
}

export interface VersionHistoryDto {
  id: string;
  experimentId: string;
  versionNumber: number;
  changeSummary?: string | null;
  snapshot: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
}

// ---- Inventory ----
export interface InventoryDto {
  id: string;
  name: string;
  type: string;
  lotNumber?: string | null;
  quantity?: string | null;
  storageLocation?: string | null;
  purity?: string | null;
  status: InventoryStatus;
  lastUsedAt?: string | null;
  createdAt: string;
}

// ---- Data ETL ----
export interface UploadResult {
  experimentId: string;
  sheets: Array<{
    sheetName: string;
    dataType: string;
    rowsInserted: number;
  }>;
  attachmentId: string;
}

export interface DataQueryResult {
  type: string;
  experimentId: string;
  rows: Record<string, unknown>[];
}
