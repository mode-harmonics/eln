import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@eln/shared';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

export { hasPermission };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const permitted = hasPermission(user.permissionList, required);
    if (!permitted) {
      throw new ForbiddenException(`You do not have the required permission: ${required}`);
    }
    return true;
  }
}
