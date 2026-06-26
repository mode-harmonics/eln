// ============================================================================
// @eln/shared — api-contract.ts
// Endpoint path constants + standard response envelopes, shared so the
// backend and future frontend never drift on URL shapes.
// ============================================================================

export const API_PREFIX = '/api/v1';

export const API_ROUTES = {
  auth: {
    login: `${API_PREFIX}/auth/login`,
  },
  users: {
    me: `${API_PREFIX}/users/me`,
  },
  roles: {
    list: `${API_PREFIX}/roles`,
  },
  projects: {
    list: `${API_PREFIX}/projects`,
    create: `${API_PREFIX}/projects`,
    members: (id: string) => `${API_PREFIX}/projects/${id}/members`,
  },
  experiments: {
    detail: (id: string) => `${API_PREFIX}/experiments/${id}`,
    update: (id: string) => `${API_PREFIX}/experiments/${id}`,
    submit: (id: string) => `${API_PREFIX}/experiments/${id}/submit`,
  },
  data: {
    upload: `${API_PREFIX}/data/upload`,
    byType: (type: string, expId: string) => `${API_PREFIX}/data/${type}/${expId}`,
  },
  ai: {
    analyzeData: `${API_PREFIX}/ai/analyze-data`,
    generateInsights: `${API_PREFIX}/ai/generate-insights`,
  },
} as const;

/** Standard success envelope used across all endpoints. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard error envelope, written by AllExceptionsFilter. */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error?: string;
  path?: string;
  timestamp?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Data ETL "type" path segment values accepted by GET /data/:type/:expId */
export const DATA_TYPE_VALUES = [
  'process',
  'calendar',
  'swelling',
  'efficiency',
  'dcr',
  'fastcharge',
  'htcycle',
] as const;

export type DataTypeValue = (typeof DATA_TYPE_VALUES)[number];