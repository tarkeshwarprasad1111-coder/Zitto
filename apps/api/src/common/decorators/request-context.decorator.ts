import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { HEADER } from '../constants';
import { ValidationDomainException } from '../exceptions/domain.exception';
import { extractIp } from '../interceptors/audit.interceptor';

/** Ambient request facts recorded alongside auth and money mutations. */
export interface RequestContextData {
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  correlationId: string | null;
  /**
   * The caller's `Idempotency-Key`, when they sent one. Present here rather than
   * as a `@Headers()` parameter because every money-moving controller needs it.
   */
  idempotencyKey: string | null;
}

/**
 * Injects the caller's network context.
 *
 * Keeps controllers free of `@Req()` and the associated temptation to reach into
 * the raw request object for things that are not context.
 */
export const ReqContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContextData => {
    const request = context.switchToHttp().getRequest<Request>();

    const deviceHeader = request.headers[HEADER.DEVICE_ID];
    const idempotencyHeader = request.headers[HEADER.IDEMPOTENCY_KEY];

    return {
      ip: extractIp(request),
      userAgent: request.headers['user-agent'] ?? null,
      deviceId: (Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader) ?? null,
      correlationId: (request.headers[HEADER.REQUEST_ID] as string | undefined) ?? null,
      idempotencyKey:
        (Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader) ?? null,
    };
  },
);

/**
 * Reads the idempotency key a money-moving route requires.
 *
 * `@Idempotent()` already makes the header mandatory, so an absent key here means
 * the guard was bypassed. Substituting anything derivable — a user id, a
 * timestamp — would burn a key the wallet ledger treats as globally unique and
 * permanently break that user's next movement, so refuse instead.
 */
export function requireIdempotencyKey(ctx: RequestContextData): string {
  if (!ctx.idempotencyKey || ctx.idempotencyKey.trim().length < 8) {
    throw new ValidationDomainException(
      'An Idempotency-Key header of at least 8 characters is required for this request.',
      'IDEMPOTENCY_KEY_REQUIRED',
    );
  }

  return ctx.idempotencyKey.trim();
}
