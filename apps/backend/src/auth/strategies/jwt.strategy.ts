import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RequestUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!
    });
  }

  /**
   * Runs on every authenticated request. Re-checks the user still exists
   * and is active (in case they were deactivated after the token was
   * issued) rather than trusting the JWT payload blindly.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active.');
    }

    const role = user.roleId ? await this.rolesRepo.findOne({ where: { id: user.roleId } }) : null;

    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: role?.name,
      permissionList: (role?.permissionList as string[] | null) ?? [],
    };
  }
}