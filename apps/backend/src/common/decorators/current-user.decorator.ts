import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@eln/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Extracts the authenticated user (from JWT payload) attached by JwtStrategy.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

export function toAuthUser(payload: JwtPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.role as AuthUser['role'],
  };
}
