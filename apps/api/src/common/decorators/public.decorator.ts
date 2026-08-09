import { SetMetadata } from '@nestjs/common';

import { META } from '../constants';

/**
 * Marks a route (or an entire controller) as reachable without authentication.
 * `JwtAuthGuard` is registered globally, so this is the only escape hatch.
 */
export const Public = () => SetMetadata(META.IS_PUBLIC, true);
