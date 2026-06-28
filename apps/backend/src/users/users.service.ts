import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcrypt';

export interface CurrentUserResult {
  id: string;
  email: string;
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

  async findAll(): Promise<any[]> {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    const roles = await this.rolesRepo.find();
    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    return users.map((user) => ({
      id: user.id,
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

  async create(dto: { email: string; fullName: string; roleId?: string; password?: string }): Promise<User> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already exists.');
    }

    const password = dto.password || 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.usersRepo.create({
      id: uuid(),
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      roleId: dto.roleId ?? null,
      isActive: true,
    });

    return this.usersRepo.save(user);
  }

  async update(id: string, dto: { email?: string; fullName?: string; roleId?: string; isActive?: boolean }): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Email already exists.');
      }
      user.email = dto.email;
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
}