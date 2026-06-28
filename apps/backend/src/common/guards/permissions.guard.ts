import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

export function hasPermission(permissionList: string[], required: string): boolean {
  if (!permissionList || permissionList.length === 0) return false;
  const [resource, action] = required.split(':');
  return permissionList.some((p) => {
    if (p === '*' || p === `${resource}:*` || p === required) return true;
    return false;
  });
}

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
