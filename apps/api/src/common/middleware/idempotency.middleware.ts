import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../../redis/redis.service';
import { HEADER, REDIS_KEY } from '../constants';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** How long a reservation may sit in-flight before we assume the request died. */
const IN_FLIGHT_TTL_SECONDS = 60;

type IdempotencyRecord =
  | { state: 'in_progress'; fingerprint: string; startedAt: string }
  | {
      state: 'completed';
      fingerprint: string;
      status: number;
      body: string;
      completedAt: string;
    };

/**
 * Replay protection for mutating requests.
 *
 * Flow for a request carrying `Idempotency-Key`:
 *  1. Reserve the key in Redis with `SET NX`. Winning the reservation means this
 *     is the first attempt — proceed and capture the response.
 *  2. Losing means a record exists:
 *     - `completed` → replay the stored status and body verbatim.
 *     - `in_progress` → 409, the original attempt is still running.
 *  3. A stored record whose request body differs from this one → 422. Reusing a
 *     key for a different payload is a client bug and must not silently succeed.
 *
 * Only 2xx responses are cached. A failed attempt releases its reservation so the
 * client can legitimately retry with the same key.
 *
 * Scoping: keys are namespaced by method, path, and a hash of the caller's
 * credential. Middleware runs before guards, so the token cannot be verified
 * here — hashing it is sufficient to keep one user's keys out of another's space.
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const rawKey = req.headers[HEADER.IDEMPOTENCY_KEY];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || key.length < 8 || key.length > 200) {
      // Absent or implausible key: nothing to protect. Routes that *require* a key
      // are enforced by IdempotencyGuard, which can read route metadata.
      next();
      return;
    }

    const scope = this.buildScope(req);
    const redisKey = REDIS_KEY.idempotency(scope, key);
    const fingerprint = this.fingerprintBody(req.body);
    const ttlSeconds = this.config.idempotencyTtlSeconds;

    let reserved: boolean;
    try {
      reserved = await this.redis.setIfAbsent(
        redisKey,
        JSON.stringify({
          state: 'in_progress',
          fingerprint,
          startedAt: new Date().toISOString(),
        } satisfies IdempotencyRecord),
        IN_FLIGHT_TTL_SECONDS,
      );
    } catch (error) {
      // Redis outage must not take the API down; fall through unprotected and shout.
      this.logger.error(
        `Idempotency store unavailable, proceeding without replay protection: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      next();
      return;
    }

    if (!reserved) {
      const existing = await this.redis.getJson<IdempotencyRecord>(redisKey);

      if (!existing) {
        // Record expired between SET NX and GET — treat as a fresh attempt.
        this.attachCapture(req, res, redisKey, fingerprint, ttlSeconds);
        next();
        return;
      }

      if (existing.fingerprint !== fingerprint) {
        res
          .status(422)
          .setHeader('Content-Type', 'application/problem+json')
          .json({
            type: 'https://zitto.dev/problems/idempotency-key-reuse',
            title: 'Unprocessable Entity',
            status: 422,
            detail:
              'This Idempotency-Key was already used with a different request body. Generate a new key.',
            instance: req.originalUrl ?? req.url,
            correlationId: (req.headers[HEADER.REQUEST_ID] as string | undefined) ?? 'unknown',
            code: 'IDEMPOTENCY_KEY_REUSE',
          });
        return;
      }

      if (existing.state === 'in_progress') {
        res
          .status(409)
          .setHeader('Content-Type', 'application/problem+json')
          .setHeader('Retry-After', '2')
          .json({
            type: 'https://zitto.dev/problems/request-in-progress',
            title: 'Conflict',
            status: 409,
            detail:
              'A request with this Idempotency-Key is still being processed. Retry shortly.',
            instance: req.originalUrl ?? req.url,
            correlationId: (req.headers[HEADER.REQUEST_ID] as string | undefined) ?? 'unknown',
            code: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
          });
        return;
      }

      res
        .status(existing.status)
        .setHeader('Content-Type', 'application/json')
        .setHeader('Idempotency-Replayed', 'true')
        .send(existing.body);
      return;
    }

    this.attachCapture(req, res, redisKey, fingerprint, ttlSeconds);
    next();
  }

  /**
   * Wraps `res.json`/`res.send` so the outgoing payload can be stored, then
   * persists (or releases) the reservation once the response is flushed.
   */
  private attachCapture(
    req: Request,
    res: Response,
    redisKey: string,
    fingerprint: string,
    ttlSeconds: number,
  ): void {
    let captured: string | undefined;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = (body: unknown): Response => {
      captured = safeStringify(body);
      return originalJson(body);
    };

    res.send = (body?: unknown): Response => {
      if (captured === undefined) {
        captured = typeof body === 'string' ? body : safeStringify(body);
      }
      return originalSend(body);
    };

    res.on('finish', () => {
      void this.persist(req, res, redisKey, fingerprint, captured, ttlSeconds);
    });

    // A dropped connection leaves no usable response to replay — free the key.
    res.on('close', () => {
      if (!res.writableEnded) {
        void this.redis.del(redisKey).catch(() => undefined);
      }
    });
  }

  private async persist(
    req: Request,
    res: Response,
    redisKey: string,
    fingerprint: string,
    body: string | undefined,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

      if (!isSuccess || body === undefined) {
        // Let the client retry the same key after a failure.
        await this.redis.del(redisKey);
        return;
      }

      await this.redis.setJson(
        redisKey,
        {
          state: 'completed',
          fingerprint,
          status: res.statusCode,
          body,
          completedAt: new Date().toISOString(),
        } satisfies IdempotencyRecord,
        ttlSeconds,
      );
    } catch (error) {
      this.logger.error(
        `Failed to persist idempotency record for ${req.method} ${req.originalUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Namespaces keys per route and per caller credential. */
  private buildScope(req: Request): string {
    const auth = req.headers.authorization ?? '';
    const principal =
      auth.length > 0 ? createHash('sha256').update(auth).digest('hex').slice(0, 24) : 'anon';
    const route = `${req.method}:${(req.baseUrl ?? '') + (req.path ?? req.url)}`;
    return `${principal}:${createHash('sha256').update(route).digest('hex').slice(0, 16)}`;
  }

  private fingerprintBody(body: unknown): string {
    return createHash('sha256').update(safeStringify(body ?? null)).digest('hex');
  }
}

/** JSON with BigInt support and stable key order, so fingerprints are reproducible. */
function safeStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), (_key, val) =>
    typeof val === 'bigint' ? val.toString() : val,
  );
}

function sortKeys(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item, depth + 1));
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v, depth + 1)]));
}
