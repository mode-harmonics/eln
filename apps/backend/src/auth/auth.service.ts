import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Looks up the user by username and verifies the password hash.
   * Throws UnauthorizedException on any mismatch (account not found,
   * wrong password, or deactivated account) — deliberately the same
   * error for all cases to avoid leaking which part failed.
   */
  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { username } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    return user;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.validateUser(username, password);
    const role = user.roleId ? await this.rolesRepo.findOne({ where: { id: user.roleId } }) : null;

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName: role?.name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: role?.name ?? null,
      },
    };
  }
}