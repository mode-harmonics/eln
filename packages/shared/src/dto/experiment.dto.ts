import { ExperimentStatus } from '../enums';

export interface ExperimentMetadataDto {
  assayType?: string;
  recordType?: string;
  notebookRef?: string;
  deviceUsed?: string;
  reagentLotId?: string;
  [key: string]: unknown;
}

export interface ExperimentDto {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  status: ExperimentStatus | string;
  metadata: ExperimentMetadataDto | null;
  aiAnalysisOutput: string | null;
  versionNo: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateExperimentDto {
  title?: string;
  content?: string;
  metadata?: ExperimentMetadataDto;
  /** Optimistic-lock token: must match the current row's versionNo. */
  versionNo: number;
  changeSummary?: string;
}

export interface SubmitExperimentDto {
  changeSummary?: string;
}

export interface ExperimentCollaboratorDto {
  id: string;
  experimentId: string;
  userId: string;
  role: string;
  createdAt: string;
}

export interface VersionHistoryDto {
  id: string;
  experimentId: string;
  versionNumber: number;
  changeSummary: string | null;
  snapshot: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
}

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
