"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATA_TYPE_VALUES = exports.API_ROUTES = exports.API_PREFIX = void 0;
exports.API_PREFIX = '/api/v1';
exports.API_ROUTES = {
    auth: {
        login: `${exports.API_PREFIX}/auth/login`,
    },
    users: {
        me: `${exports.API_PREFIX}/users/me`,
    },
    roles: {
        list: `${exports.API_PREFIX}/roles`,
    },
    projects: {
        list: `${exports.API_PREFIX}/projects`,
        create: `${exports.API_PREFIX}/projects`,
        members: (id) => `${exports.API_PREFIX}/projects/${id}/members`,
    },
    experiments: {
        detail: (id) => `${exports.API_PREFIX}/experiments/${id}`,
        update: (id) => `${exports.API_PREFIX}/experiments/${id}`,
        submit: (id) => `${exports.API_PREFIX}/experiments/${id}/submit`,
    },
    data: {
        upload: `${exports.API_PREFIX}/data/upload`,
        byType: (type, expId) => `${exports.API_PREFIX}/data/${type}/${expId}`,
    },
    ai: {
        analyzeData: `${exports.API_PREFIX}/ai/analyze-data`,
        generateInsights: `${exports.API_PREFIX}/ai/generate-insights`,
    },
};
exports.DATA_TYPE_VALUES = [
    'process',
    'calendar',
    'swelling',
    'efficiency',
    'dcr',
    'fastcharge',
    'htcycle',
];
//# sourceMappingURL=api-contract.js.map