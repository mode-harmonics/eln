import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { DataSource, In } from 'typeorm';
import { ROLE_DEFAULT_PERMISSIONS } from '@eln/shared';
import * as entities from './entities';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { DEFAULT_WORKFLOW_STEPS } from './default-workflow';

type BootstrapEnvironment = Record<string, string | undefined>;

export interface BootstrapConfig {
  databaseUrl: string;
  username: string;
  password: string;
  fullName: string;
}

export function readBootstrapConfig(env: BootstrapEnvironment): BootstrapConfig {
  if (env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production.');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const username = env.ELN_BOOTSTRAP_USERNAME;
  if (!username || username.length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    throw new Error('ELN_BOOTSTRAP_USERNAME must be 1–64 letters, digits, _, . or -.');
  }
  const password = env.ELN_BOOTSTRAP_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 || password === 'Password123!') {
    throw new Error('ELN_BOOTSTRAP_PASSWORD must be a unique password of at least 12 characters and at most 72 UTF-8 bytes.');
  }
  const fullName = env.ELN_BOOTSTRAP_FULL_NAME?.trim() || username;
  if (fullName.length > 64) throw new Error('ELN_BOOTSTRAP_FULL_NAME must be at most 64 characters.');
  return { databaseUrl: env.DATABASE_URL, username, password, fullName };
}

/** One transaction prevents partially initialized production databases. */
export async function bootstrapProduction(dataSource: DataSource, config: BootstrapConfig): Promise<'created' | 'already_initialized' | 'migrated'> {
  return dataSource.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(274392814)');
    const users = manager.getRepository(User);
    const roles = manager.getRepository(Role);
    const existingCount = await users.count();
    if (existingCount > 0) {
      const existing = await users.findOne({ where: { username: config.username } });
      const currentRole = existing?.roleId
        ? await roles.findOne({ where: { id: existing.roleId } })
        : null;
      if (existing?.isActive && currentRole?.name === 'Admin' &&
        ROLE_DEFAULT_PERMISSIONS.Admin.every((permission) => currentRole.permissionList?.includes(permission))) {
        return 'already_initialized';
      }
      // Upgrade only the exact four-role bootstrap written by the previous version.
      // Leave any populated or customized installation untouched.
      if (existingCount === 1 && existing?.isActive && currentRole?.name === 'Owner' && currentRole.permissionList?.includes('*')) {
        const existingRoles = await roles.find();
        const presets = ['Owner', 'Admin', 'Editor', 'Viewer'] as const;
        const isOldBootstrap = existingRoles.length === presets.length && presets.every((name) => {
          const role = existingRoles.find((candidate) => candidate.name === name);
          const expected = ROLE_DEFAULT_PERMISSIONS[name];
          return role && role.permissionList?.length === expected.length && expected.every((permission) => role.permissionList?.includes(permission));
        });
        if (isOldBootstrap) {
          const admin = existingRoles.find((role) => role.name === 'Admin')!;
          existing.roleId = admin.id;
          await users.save(existing);
          await roles.delete({ id: In(existingRoles.filter((role) => role.id !== admin.id).map((role) => role.id)) });
          return 'migrated';
        }
      }
      throw new Error('Database already has users; refusing to create a privileged account.');
    }

    let admin = await roles.findOne({ where: { name: 'Admin' } });
    if (!admin) {
      admin = await roles.save(roles.create({ id: uuid(), name: 'Admin', permissionList: ROLE_DEFAULT_PERMISSIONS.Admin }));
    }
    if (!ROLE_DEFAULT_PERMISSIONS.Admin.every((permission) => admin.permissionList?.includes(permission))) {
      throw new Error('Admin role is missing required permissions; refusing to create administrator.');
    }

    const templates = manager.getRepository(WorkflowTemplate);
    if (!(await templates.exist({ where: { isDefault: true } }))) {
      await templates.save(templates.create({
        id: uuid(),
        name: '默认实验流程',
        description: '系统内置的默认电池实验流程模板',
        isDefault: true,
        steps: DEFAULT_WORKFLOW_STEPS,
      }));
    }
    await users.save(users.create({
      id: uuid(),
      username: config.username,
      passwordHash: await bcrypt.hash(config.password, 12),
      fullName: config.fullName,
      email: null,
      roleId: admin.id,
      isActive: true,
    }));
    return 'created';
  });
}

export async function runProductionBootstrap(): Promise<void> {
  const config = readBootstrapConfig(process.env);
  const dataSource = new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    entities: Object.values(entities),
    synchronize: false,
  });
  try {
    await dataSource.initialize();
    const result = await bootstrapProduction(dataSource, config);
    console.log(result === 'created'
      ? 'Production administrator, Admin role and default workflow created.'
      : result === 'migrated'
        ? 'Previous bootstrap converted to one Admin role; administrator password unchanged.'
        : 'Production administrator already exists; no changes made.');
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

export function reportBootstrapError(error: unknown): void {
  if (error instanceof Error && (
    error.message.startsWith('NODE_ENV') ||
    error.message.startsWith('DATABASE_URL') ||
    error.message.startsWith('ELN_BOOTSTRAP_') ||
    error.message.startsWith('Database already has users') ||
    error.message.startsWith('Admin role')
  )) {
    console.error(error.message);
  } else {
    console.error('Production bootstrap failed. Verify migrations and database connectivity.');
  }
  process.exitCode = 1;
}
