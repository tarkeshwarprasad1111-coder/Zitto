import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the authenticated principal.
 *
 * `@CurrentUser()` yields the whole object; `@CurrentUser('id')` yields one field.
 * Throws if used on a route that is not behind `JwtAuthGuard` — that is a wiring
 * bug, not a client error, and should be loud.
 */
export const CurrentUser = createParamDecorator(
  <K extends keyof AuthenticatedUser>(
    field: K | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[K] => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('No authenticated user on this request.');
    }

    return field ? user[field] : user;
  },
);
