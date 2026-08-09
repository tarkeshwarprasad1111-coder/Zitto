import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { HEADER, META } from '../constants';
import type { IdempotentMetadata } from '../decorators/idempotent.decorator';
import { ValidationDomainException } from '../exceptions/domain.exception';

/**
 * Enforces the presence of `Idempotency-Key` on routes marked `@Idempotent()`.
 *
 * The caching itself lives in `IdempotencyMiddleware`, which runs earlier but
 * cannot read route metadata. This guard is the metadata-aware half.
 */
@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<IdempotentMetadata | undefined>(
      META.IDEMPOTENT,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata?.required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const raw = request.headers[HEADER.IDEMPOTENCY_KEY];
    const key = Array.isArray(raw) ? raw[0] : raw;

    if (!key || key.trim().length < 8) {
      throw new ValidationDomainException(
        'This endpoint requires an Idempotency-Key header (a client-generated UUID) so retries cannot double-apply.',
        'IDEMPOTENCY_KEY_REQUIRED',
        [{ path: 'headers.idempotency-key', message: 'Required, minimum 8 characters.' }],
      );
    }

    return true;
  }
}
