import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { META } from '../constants';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Global authentication gate.
 *
 * Registered as an APP_GUARD, so every route requires a valid access token
 * unless it carries `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(META.IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err || !user) {
      const reason =
        info instanceof Error
          ? info.name === 'TokenExpiredError'
            ? 'Access token has expired.'
            : 'Access token is invalid.'
          : 'Authentication is required to access this resource.';

      throw err instanceof Error ? err : new UnauthorizedException(reason);
    }

    return user;
  }
}
