import { UsersService } from './users.service';
import { User } from '../entities/user.entity';

describe('User mutation response privacy', () => {
  it('does not return the password hash after creating a user', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: (value: Partial<User>) => Object.assign(new User(), value),
      save: jest.fn(async (value: User) => value),
    };
    const service = new UsersService(repo as any, {} as any);
    const result = await service.create({ username: 'review-user', fullName: 'Review' });
    expect(result).not.toHaveProperty('passwordHash');
    expect(repo.save.mock.calls[0][0].passwordHash).toMatch(/^\$2/);
  });

  it('does not return an existing hash after updating a user', async () => {
    const user = Object.assign(new User(), { id: 'user-id', username: 'review', passwordHash: 'synthetic-hash' });
    const repo = { findOne: jest.fn().mockResolvedValue(user), save: jest.fn(async value => value) };
    const service = new UsersService(repo as any, {} as any);
    const result = await service.update(user.id, { fullName: 'Updated' });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.fullName).toBe('Updated');
  });
});
