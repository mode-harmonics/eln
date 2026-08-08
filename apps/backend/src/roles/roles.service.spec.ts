import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;

  const rolesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RolesService(rolesRepo as any);
  });

  describe('create', () => {
    it('creates and returns a new role when name is unique', async () => {
      rolesRepo.findOne.mockResolvedValue(null);
      rolesRepo.create.mockImplementation((dto) => dto);
      rolesRepo.save.mockImplementation((role) => Promise.resolve(role));

      const res = await service.create({ name: 'Engineer', permissionList: ['projects:read'] });

      expect(rolesRepo.findOne).toHaveBeenCalledWith({ where: { name: 'Engineer' } });
      expect(rolesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Engineer',
          permissionList: ['projects:read'],
        }),
      );
      expect(res.name).toBe('Engineer');
    });

    it('throws ConflictException when role name already exists', async () => {
      rolesRepo.findOne.mockResolvedValue({ id: 'role-1', name: 'Engineer' });

      await expect(
        service.create({ name: 'Engineer' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates role permission list', async () => {
      const existingRole = { id: 'role-1', name: 'Tester', permissionList: [] };
      rolesRepo.findOne.mockResolvedValue(existingRole);
      rolesRepo.save.mockImplementation((role) => Promise.resolve(role));

      const updated = await service.update('role-1', ['projects:read', 'experiments:read']);

      expect(updated.permissionList).toEqual(['projects:read', 'experiments:read']);
    });

    it('throws NotFoundException when role does not exist', async () => {
      rolesRepo.findOne.mockResolvedValue(null);

      await expect(service.update('invalid-id', [])).rejects.toThrow(NotFoundException);
    });
  });
});
