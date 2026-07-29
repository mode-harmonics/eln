/**
 * Centralised permission constants — single source of truth for backend guards,
 * seed scripts, and frontend RBAC editors.
 *
 * When adding a new module, register its resource key here first, then update
 * seed.ts, Roles.tsx, and any @RequirePermission decorators.
 */
export const PERMISSION_RESOURCES = [
  'projects',
  'experiments',
  'data',
  'workflow',
  'users',
  'roles',
  'experiment_design',
  'procurement',
  'dashboard',
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

/** Standard CRUD actions */
const ACTIONS = ['read', 'write', '*'] as const;

/** Special actions beyond read/write */
const SPECIAL_ACTIONS = ['approve', 'archive', 'transition'] as const;

/** Data child types (for data_${type}:action granularity) */
export const DATA_CHILD_TYPES = [
  'process',
  'solution',
  'calendar',
  'swelling',
  'efficiency',
  'dcr',
  'fastcharge',
  'htcycle',
] as const;

/** Build a flat list of all known permission strings */
export const ALL_PERMISSIONS: string[] = (() => {
  const list: string[] = [];
  for (const res of PERMISSION_RESOURCES) {
    for (const act of ACTIONS) list.push(`${res}:${act}`);
    if (res === 'experiments') list.push('experiments:approve', 'experiments:archive');
    if (res === 'workflow') list.push('workflow:transition');
  }
  for (const child of DATA_CHILD_TYPES) {
    for (const act of ACTIONS) list.push(`data_${child}:${act}`);
  }
  return list;
})();

/** Role presets — used by seed.ts and referenced by Roles.tsx */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  Owner: [
    'projects:*', 'experiments:*', 'data:*', 'users:*', 'roles:*',
    'workflow:*', 'experiment_design:*', 'procurement:*', 'dashboard:*',
  ],
  Admin: [
    'projects:read', 'projects:write', 'experiments:*', 'data:*',
    'users:read', 'users:write',
    'roles:read', 'roles:write',
    'workflow:*', 'experiment_design:*', 'procurement:*', 'dashboard:read',
  ],
  Editor: [
    'projects:read', 'experiments:read', 'experiments:write',
    'data:read', 'data:write',
    'workflow:read', 'workflow:transition',
    'experiment_design:read', 'experiment_design:write',
    'procurement:read', 'procurement:write', 'dashboard:read',
  ],
  Viewer: [
    'projects:read', 'experiments:read', 'data:read', 'dashboard:read',
  ],
};
