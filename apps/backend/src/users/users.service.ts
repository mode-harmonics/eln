import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

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
}