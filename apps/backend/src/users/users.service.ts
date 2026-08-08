import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcrypt';

export interface CurrentUserResult {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  avatar: string | null;
  roleId: string | null;
  roleName: string | null;
  permissionList: string[];
  departmentId: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  async getCurrentUser(userId: string): Promise<CurrentUserResult> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const role = user.roleId ? await this.rolesRepo.findOne({ where: { id: user.roleId } }) : null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      roleId: user.roleId,
      roleName: role?.name ?? null,
      permissionList: (role?.permissionList as string[] | null) ?? [],
      departmentId: user.departmentId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async findAll(
    page?: number,
    limit?: number,
    search?: string,
    withRole?: boolean,
  ): Promise<any> {
    if (page === undefined && limit === undefined) {
      // Fallback for non-paginated queries (e.g. dropdown list requests)
      const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
      const roles = await this.rolesRepo.find();
      const roleMap = new Map(roles.map((r) => [r.id, r.name]));
      return users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        roleId: user.roleId,
        roleName: user.roleId ? roleMap.get(user.roleId) ?? null : null,
        departmentId: user.departmentId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }));
    }

    const pageNum = page ? parseInt(page as any, 10) : 1;
    const limitNum = limit ? parseInt(limit as any, 10) : 10;

    const query = this.usersRepo.createQueryBuilder('user');

    if (withRole) {
      query.leftJoinAndSelect('user.role', 'role');
    }

    if (search) {
      query.andWhere(
        '(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(user.username) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    query.orderBy('user.createdAt', 'DESC');

    const skip = (pageNum - 1) * limitNum;
    query.skip(skip).take(limitNum);

    const [users, total] = await query.getManyAndCount();

    const items = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      roleId: user.roleId,
      roleName: user.roleId && withRole ? user.role?.name ?? null : null,
      departmentId: user.departmentId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));

    return { items, total };
  }

  async create(dto: { username: string; email?: string; fullName: string; roleId?: string; password?: string }): Promise<User> {
    if (/[\u4e00-\u9fa5]/.test(dto.username) || !/^[a-zA-Z0-9_.-]+$/.test(dto.username)) {
      throw new BadRequestException('用户名不能包含中文或特殊字符，只能包含英文字母、数字、下划线、连字符或点。');
    }

    const normalizedEmail = dto.email?.trim() || null;
    if (normalizedEmail) {
      const existingEmail = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
      if (existingEmail) {
        throw new ConflictException('Email already exists.');
      }
    }
    const existingUsername = await this.usersRepo.findOne({ where: { username: dto.username } });
    if (existingUsername) {
      throw new ConflictException('Username already exists.');
    }

    const password = dto.password || 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.usersRepo.create({
      id: uuid(),
      username: dto.username,
      email: normalizedEmail,
      fullName: dto.fullName,
      passwordHash,
      roleId: dto.roleId ?? null,
      isActive: true,
    });

    return this.usersRepo.save(user);
  }

  async update(id: string, dto: { username?: string; email?: string; fullName?: string; roleId?: string; isActive?: boolean }): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (dto.username !== undefined && dto.username !== user.username) {
      if (/[\u4e00-\u9fa5]/.test(dto.username) || !/^[a-zA-Z0-9_.-]+$/.test(dto.username)) {
        throw new BadRequestException('用户名不能包含中文或特殊字符，只能包含英文字母、数字、下划线、连字符或点。');
      }
      const existing = await this.usersRepo.findOne({ where: { username: dto.username } });
      if (existing) {
        throw new ConflictException('Username already exists.');
      }
      user.username = dto.username;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim() || null;
      if (normalizedEmail && normalizedEmail !== user.email) {
        const existing = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
        if (existing) {
          throw new ConflictException('Email already exists.');
        }
      }
      user.email = normalizedEmail;
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.roleId !== undefined) user.roleId = dto.roleId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    return this.usersRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    await this.usersRepo.remove(user);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const passwordMatches = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);
    return { success: true };
  }
}
