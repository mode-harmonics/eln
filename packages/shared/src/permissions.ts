/**
 * Centralised permission constants & unified matching engine — single source of truth
 * for backend guards, seed scripts, and frontend RBAC editors.
 */

export const PERMISSION_RESOURCES = [
  'experiments',
  'workflow',
  'system',
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export interface PermissionActionMeta {
  key: string;
  label: string;
  badge?: string;
}

export interface PermissionGroupMeta {
  key: PermissionResource;
  label: string;
  description: string;
  actions: PermissionActionMeta[];
}

/** Permission tree metadata used for dynamic rendering of frontend RBAC modal */
export const PERMISSION_TREE_META: PermissionGroupMeta[] = [
  {
    key: 'experiments',
    label: '项目与实验',
    description: '项目管理、实验记录、配方设计、采购申请、电池测试数据及流程推进',
    actions: [
      { key: 'read', label: '查看' },
      { key: 'write', label: '编辑/推进' },
      { key: 'approve', label: '审批' },
      { key: 'archive', label: '归档' },
    ],
  },
  {
    key: 'workflow',
    label: '工作流模板',
    description: '全局工作流模板创建、步骤定义与流程编排',
    actions: [
      { key: 'read', label: '查看' },
      { key: 'write', label: '编辑' },
    ],
  },
  {
    key: 'system',
    label: '系统与账号',
    description: '账号开通、角色权限配置与物资库存管理',
    actions: [
      { key: 'read', label: '查看' },
      { key: 'write', label: '编辑' },
    ],
  },
];

/** Role presets — used by seed.ts and referenced by Roles.tsx */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  Owner: ['*'],
  Admin: ['experiments:*', 'workflow:*', 'system:*'],
  Editor: ['experiments:read', 'experiments:write', 'workflow:read'],
  Viewer: ['experiments:read'],
};

/** Normalize legacy permission strings to the 3 consolidated domains */
function normalizePermission(perm: string): string {
  if (perm === '*' || perm.endsWith(':*')) return perm;

  const [res, action] = perm.split(':');

  // Dashboard is open to all authenticated users
  if (res === 'dashboard') return 'experiments:read';

  // Projects, Experiments, Design, Procurement, Data, Workflow Transition -> experiments domain
  if (
    res === 'projects' ||
    res === 'experiments' ||
    res === 'experiment_design' ||
    res === 'procurement' ||
    res === 'data' ||
    res.startsWith('data_')
  ) {
    if (action === 'approve' || action === 'archive') return `experiments:${action}`;
    return action === 'write' || action === 'transition' ? 'experiments:write' : 'experiments:read';
  }

  // Workflow template management
  if (res === 'workflow') {
    return action === 'write' ? 'workflow:write' : 'workflow:read';
  }

  // Users, Roles, Inventory -> system domain
  if (res === 'users' || res === 'roles' || res === 'inventory' || res === 'system') {
    return action === 'write' ? 'system:write' : 'system:read';
  }

  return perm;
}

/** Unified permission checker supporting wildcards & legacy aliases */
export function hasPermission(
  userPermissions: string[] | null | undefined,
  required: string,
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;

  const target = normalizePermission(required);
  const [targetRes, targetAction] = target.split(':');

  return userPermissions.some((p) => {
    if (p === '*') return true;
    if (p === `${targetRes}:*`) return true;

    const normalizedP = normalizePermission(p);
    if (normalizedP === target) return true;
    if (normalizedP === `${targetRes}:*`) return true;

    // Wildcard action match
    const [pRes, pAction] = normalizedP.split(':');
    if (pRes === targetRes && (pAction === '*' || pAction === targetAction)) return true;

    return false;
  });
}
