import { ValidationPipe } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
function validate(method: string, index: number, value: unknown) {
  const metatype = Reflect.getMetadata('design:paramtypes', UsersController.prototype, method)[index];
  return pipe.transform(value, { type: 'body', metatype });
}
describe('User HTTP validation contract', () => {
  it.each([{ fullName: null }, { fullName: '   ' }, { isActive: null }, { password: 'new-secret' }, { roleId: 'invalid' }])('rejects invalid update %p', async body => {
    await expect(validate('update', 1, body)).rejects.toThrow();
  });
  it('rejects missing old password before bcrypt', async () => {
    await expect(validate('changePassword', 1, { newPassword: 'Synthetic123!' })).rejects.toThrow();
  });
  it('accepts empty email and nullable role as existing UI contracts', async () => {
    await expect(validate('update', 1, { email: '', roleId: null })).resolves.toMatchObject({ email: '', roleId: null });
  });
  it('allows clearing nullable email without crashing', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ id: 'user', email: 'old@example.test' }), save: jest.fn(async value => value) };
    const service = new UsersService(repo as any, {} as any);
    await expect(service.update('user', { email: null } as any)).resolves.toMatchObject({ email: null });
  });
});
