export declare const API_PREFIX = "/api/v1";
export declare const API_ROUTES: {
    readonly auth: {
        readonly login: "/api/v1/auth/login";
    };
    readonly users: {
        readonly me: "/api/v1/users/me";
    };
    readonly roles: {
        readonly list: "/api/v1/roles";
    };
    readonly projects: {
        readonly list: "/api/v1/projects";
        readonly create: "/api/v1/projects";
        readonly members: (id: string) => string;
    };
    readonly experiments: {
        readonly detail: (id: string) => string;
        readonly update: (id: string) => string;
        readonly submit: (id: string) => string;
    };
    readonly data: {
        readonly upload: "/api/v1/data/upload";
        readonly byType: (type: string, expId: string) => string;
    };
    readonly ai: {
        readonly analyzeData: "/api/v1/ai/analyze-data";
        readonly generateInsights: "/api/v1/ai/generate-insights";
    };
};
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}
export interface ApiErrorResponse {
    success: false;
    statusCode: number;
    message: string;
    error?: string;
    path?: string;
    timestamp?: string;
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
export declare const DATA_TYPE_VALUES: readonly ["process", "calendar", "swelling", "efficiency", "dcr", "fastcharge", "htcycle"];
export type DataTypeValue = (typeof DATA_TYPE_VALUES)[number];
