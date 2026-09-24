import { bootstrapProduction, readBootstrapConfig } from './bootstrap-production';
import { DataSource } from 'typeorm';
import { ROLE_DEFAULT_PERMISSIONS } from '@eln/shared';

describe('production bootstrap configuration', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://localhost/eln',
    ELN_BOOTSTRAP_USERNAME: 'first_admin',
    ELN_BOOTSTRAP_PASSWORD: 'a-long-unique-password',
  };

  it('requires an explicit production database and administrator credentials', () => {
    expect(() => readBootstrapConfig({ ...valid, DATABASE_URL: undefined })).toThrow('DATABASE_URL');
    expect(() => readBootstrapConfig({ ...valid, ELN_BOOTSTRAP_PASSWORD: undefined })).toThrow('ELN_BOOTSTRAP_PASSWORD');
    expect(() => readBootstrapConfig({ ...valid, NODE_ENV: 'development' })).toThrow('NODE_ENV');
  });

  it('rejects invalid usernames and weak passwords before connecting', () => {
    expect(() => readBootstrapConfig({ ...valid, ELN_BOOTSTRAP_USERNAME: 'bad user' })).toThrow('ELN_BOOTSTRAP_USERNAME');
    expect(() => readBootstrapConfig({ ...valid, ELN_BOOTSTRAP_PASSWORD: 'Password123!' })).toThrow('ELN_BOOTSTRAP_PASSWORD');
    expect(() => readBootstrapConfig({ ...valid, ELN_BOOTSTRAP_PASSWORD: '长'.repeat(30) })).toThrow('ELN_BOOTSTRAP_PASSWORD');
  });

  it('accepts a named first administrator', () => {
    expect(readBootstrapConfig({ ...valid, ELN_BOOTSTRAP_FULL_NAME: 'Lab Owner' })).toMatchObject({
      username: 'first_admin',
      fullName: 'Lab Owner',
    });
  });
});

describe('production bootstrap on an existing database', () => {
  const config = readBootstrapConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost/eln',
    ELN_BOOTSTRAP_USERNAME: 'first_admin', ELN_BOOTSTRAP_PASSWORD: 'a-long-unique-password',
  });

  function source(existing: { username: string; roleId: string; isActive: boolean } | null, roleName = 'Admin') {
    const userRepo = { count: jest.fn().mockResolvedValue(1), findOne: jest.fn().mockResolvedValue(existing), save: jest.fn() };
    const roleRepo = { findOne: jest.fn().mockResolvedValue({ name: roleName, permissionList: ['experiments:*', 'workflow:*', 'workflow_step:*', 'system:*'] }) };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: { name: string }) => entity.name === 'User' ? userRepo : roleRepo),
    };
    const dataSource = { transaction: jest.fn((callback: (manager: unknown) => Promise<unknown>) => callback(manager)) } as unknown as DataSource;
    return { dataSource, userRepo, manager };
  }

  it('does not reset an existing active Admin password', async () => {
    const { dataSource, userRepo } = source({ username: config.username, roleId: 'admin-id', isActive: true });
    await expect(bootstrapProduction(dataSource, config)).resolves.toBe('already_initialized');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('refuses privilege escalation when the database has another user', async () => {
    const { dataSource, userRepo } = source(null);
    await expect(bootstrapProduction(dataSource, config)).rejects.toThrow('Database already has users');
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});

describe('production bootstrap role scope', () => {
  const config = readBootstrapConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost/eln',
    ELN_BOOTSTRAP_USERNAME: 'first_admin', ELN_BOOTSTRAP_PASSWORD: 'a-long-unique-password',
  });

  it('creates only one Admin role and one administrator on an empty database', async () => {
    const userRepo = { count: jest.fn().mockResolvedValue(0), create: jest.fn((value) => value), save: jest.fn() };
    const roleRepo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((value) => value), save: jest.fn(async (value) => value) };
    const templateRepo = { exist: jest.fn().mockResolvedValue(false), create: jest.fn((value) => value), save: jest.fn() };
    const manager = { query: jest.fn(), getRepository: jest.fn((entity: { name: string }) => ({ User: userRepo, Role: roleRepo, WorkflowTemplate: templateRepo })[entity.name]) };
    const source = { transaction: jest.fn((callback: (value: typeof manager) => Promise<unknown>) => callback(manager)) } as unknown as DataSource;

    await expect(bootstrapProduction(source, config)).resolves.toBe('created');
    expect(roleRepo.save).toHaveBeenCalledTimes(1);
    expect(roleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Admin', permissionList: ROLE_DEFAULT_PERMISSIONS.Admin }));
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ roleId: expect.any(String) }));
  });

  it('converts the previous untouched four-role bootstrap to one Admin role', async () => {
    const oldRoles = (['Owner', 'Admin', 'Editor', 'Viewer'] as const).map((name) => ({
      id: `${name}-id`, name, permissionList: ROLE_DEFAULT_PERMISSIONS[name],
    }));
    const existing = { username: config.username, roleId: 'Owner-id', isActive: true };
    const userRepo = { count: jest.fn().mockResolvedValue(1), findOne: jest.fn().mockResolvedValue(existing), save: jest.fn() };
    const roleRepo = { findOne: jest.fn().mockResolvedValue(oldRoles[0]), find: jest.fn().mockResolvedValue(oldRoles), delete: jest.fn() };
    const manager = { query: jest.fn(), getRepository: jest.fn((entity: { name: string }) => entity.name === 'User' ? userRepo : roleRepo) };
    const source = { transaction: jest.fn((callback: (value: typeof manager) => Promise<unknown>) => callback(manager)) } as unknown as DataSource;

    await expect(bootstrapProduction(source, config)).resolves.toBe('migrated');
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ roleId: 'Admin-id' }));
    expect(roleRepo.delete).toHaveBeenCalledTimes(1);
    expect(roleRepo.delete.mock.calls[0][0].id.value).toEqual(['Owner-id', 'Editor-id', 'Viewer-id']);
  });
});
