import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  username: string;
  email: string;
  roleId: string | null;
  roleName?: string;
  permissionList: string[];
}

/**
 * Extracts the authenticated user (from JWT payload) attached by JwtStrategy.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
