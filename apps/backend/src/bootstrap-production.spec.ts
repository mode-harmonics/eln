import { bootstrapProduction, readBootstrapConfig } from './bootstrap-production';
import { DataSource } from 'typeorm';

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

  function source(existing: { username: string; roleId: string; isActive: boolean } | null, roleName = 'Owner') {
    const userRepo = { count: jest.fn().mockResolvedValue(1), findOne: jest.fn().mockResolvedValue(existing), save: jest.fn() };
    const roleRepo = { findOne: jest.fn().mockResolvedValue({ name: roleName, permissionList: ['*'] }) };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: { name: string }) => entity.name === 'User' ? userRepo : roleRepo),
    };
    const dataSource = { transaction: jest.fn((callback: (manager: unknown) => Promise<unknown>) => callback(manager)) } as unknown as DataSource;
    return { dataSource, userRepo, manager };
  }

  it('does not reset an existing active Owner password', async () => {
    const { dataSource, userRepo } = source({ username: config.username, roleId: 'owner-id', isActive: true });
    await expect(bootstrapProduction(dataSource, config)).resolves.toBe('already_initialized');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('refuses privilege escalation when the database has another user', async () => {
    const { dataSource, userRepo } = source(null);
    await expect(bootstrapProduction(dataSource, config)).rejects.toThrow('Database already has users');
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
