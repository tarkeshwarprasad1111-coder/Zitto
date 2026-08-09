import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

import { META } from '../constants';

export interface IdempotentOptions {
  /**
   * Reject the request with 400 when the `Idempotency-Key` header is absent.
   * Defaults to `true` — money-moving endpoints must be replay-safe.
   */
  required?: boolean;
  /** Override the cache TTL for this route, in seconds. */
  ttlSeconds?: number;
}

export interface IdempotentMetadata extends Required<Pick<IdempotentOptions, 'required'>> {
  ttlSeconds?: number;
}

/**
 * Declares a route as idempotent.
 *
 * `IdempotencyMiddleware` reads this metadata to decide whether to enforce the
 * `Idempotency-Key` header and how long to retain the cached response. Also
 * documents the header in Swagger so clients cannot miss it.
 */
export function Idempotent(options: IdempotentOptions = {}) {
  const metadata: IdempotentMetadata = {
    required: options.required ?? true,
    ttlSeconds: options.ttlSeconds,
  };

  return applyDecorators(
    SetMetadata(META.IDEMPOTENT, metadata),
    ApiHeader({
      name: 'Idempotency-Key',
      description:
        'Client-generated UUID. Replaying a request with the same key returns the original response instead of performing the action twice.',
      required: metadata.required,
      schema: { type: 'string', format: 'uuid' },
    }),
  );
}
