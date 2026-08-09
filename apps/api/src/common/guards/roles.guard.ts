import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { META, ROLE, type RoleCode } from '../constants';
import { ForbiddenDomainException, UnauthorizedDomainException } from '../exceptions/domain.exception';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * RBAC gate. Runs after `JwtAuthGuard`, so `request.user` is populated.
 *
 * `super_admin` implicitly satisfies every requirement — otherwise a
 * misconfigured role seed could lock operators out of their own platform.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(META.IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(META.ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedDomainException('Authentication is required for this resource.');
    }

    const held = new Set(user.roles);

    if (held.has(ROLE.SUPER_ADMIN)) {
      return true;
    }

    const permitted = requiredRoles.some((role) => held.has(role));

    if (!permitted) {
      throw new ForbiddenDomainException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}.`,
        'INSUFFICIENT_ROLE',
      );
    }

    return true;
  }
}
