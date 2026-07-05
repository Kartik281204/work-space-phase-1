import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Restrict a route to one or more roles, e.g. @Roles('OWNER', 'ADMIN').
 * Must be combined with RolesGuard (applied globally in AppModule).
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
