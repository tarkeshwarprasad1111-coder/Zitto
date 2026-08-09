import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorType } from '@prisma/client';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AuditService } from '../audit/audit.service';
import { HEADER, META } from '../constants';
import type { AuthenticatedUser } from '../types/authenticated-user';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Never persisted to the audit trail, at any nesting depth. */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'code',
  'otp',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'twofactorsecret',
  'authorization',
]);

/**
 * HTTP-level audit trail for mutating requests.
 *
 * This is the coarse net: it records *that* a mutating call succeeded, by whom,
 * from where. Services additionally write their own domain-specific entries
 * inside their transactions — those are the authoritative ones for money.
 * Read requests and failed requests are not recorded here (failures surface via
 * the exception filter's logs).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    const explicitAction = this.reflector.getAllAndOverride<string | undefined>(
      META.AUDIT_ACTION,
      [context.getHandler(), context.getClass()],
    );

    const action =
      explicitAction ??
      `http.${context.getClass().name.replace(/Controller$/, '').toLowerCase()}.${context.getHandler().name}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const user = (request as Request & { user?: AuthenticatedUser }).user;

          void this.auditService.record({
            actorType: user ? ActorType.USER : ActorType.SYSTEM,
            actorId: user?.id ?? null,
            action,
            targetType: 'http_request',
            targetId: null,
            payload: {
              method: request.method,
              path: request.originalUrl ?? request.url,
              body: redact(request.body),
              params: redact(request.params),
            },
            ip: extractIp(request),
            userAgent: request.headers['user-agent'] ?? null,
            correlationId: (request.headers[HEADER.REQUEST_ID] as string | undefined) ?? null,
          });
        },
      }),
    );
  }
}

export function extractIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? null;
  }
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

/** Recursively strips secrets. Depth-bounded to avoid pathological payloads. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }

  return value;
}
