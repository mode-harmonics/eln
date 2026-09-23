import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { CreateProjectDto } from '../projects/dto/create-project.dto';
import { UpdateProjectDto } from '../projects/dto/update-project.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const inventoryType = (method: 'create' | 'update') =>
  Reflect.getMetadata('design:paramtypes', InventoryController.prototype, method)[method === 'create' ? 0 : 1];
const check = (metatype: any, body: unknown) => pipe.transform(body, { type: 'body', metatype });

describe('inventory and project input validation', () => {
  it.each(['-1', '1000000000000', '1.1234567', 'NaN', 5])('rejects invalid inventory quantity %s', async (quantity) => {
    await expect(check(inventoryType('create'), { name: 'Salt', type: 'Reagent', quantity })).rejects.toThrow();
  });
  it.each(['create', 'update'] as const)('rejects system fields on inventory %s', async (method) => {
    await expect(check(inventoryType(method), { name: 'Salt', type: 'Reagent', id: 'replacement' })).rejects.toThrow();
  });
  it('preserves decimal strings and nullable fields', async () => {
    const result = await check(inventoryType('create'), { name: ' Salt ', type: 'Reagent', quantity: '999999999999.123456', lotNumber: null, lastUsedAt: '2026-09-23T00:00:00.000Z' });
    expect(result.quantity).toBe('999999999999.123456');
    expect(result.name).toBe('Salt');
    await expect(check(inventoryType('update'), { quantity: null })).resolves.toMatchObject({ quantity: null });
  });
  it.each([{ name: ' ' }, { name: null }, { status: 'invalid' }, { lastUsedAt: 'yesterday' }])('rejects invalid inventory update %j', async (body) => {
    await expect(check(inventoryType('update'), body)).rejects.toThrow();
  });
  it.each([CreateProjectDto, UpdateProjectDto])('validates project names and status with %p', async (dto) => {
    await expect(check(dto, { name: ' ' })).rejects.toThrow();
    await expect(check(dto, { name: null })).rejects.toThrow();
    await expect(check(dto, { name: 'Project', status: 'invalid' })).rejects.toThrow();
    await expect(check(dto, { name: ' Project ', status: 'Active' })).resolves.toMatchObject({ name: 'Project' });
  });
});
