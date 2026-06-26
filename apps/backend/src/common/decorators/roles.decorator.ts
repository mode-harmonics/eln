import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@eln/shared';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the given roles. Use with RolesGuard.
 * @example @Roles(RoleName.Admin, RoleName.Owner)
 */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
