import { SetMetadata } from '@nestjs/common';

import { META, type RoleCode } from '../constants';

/**
 * Restricts a route to holders of at least one of the listed role codes.
 *
 * @example
 * ```ts
 * @Roles('admin', 'super_admin')
 * @Patch(':id/status')
 * suspend() {}
 * ```
 */
export const Roles = (...roles: RoleCode[]) => SetMetadata(META.ROLES, roles);
