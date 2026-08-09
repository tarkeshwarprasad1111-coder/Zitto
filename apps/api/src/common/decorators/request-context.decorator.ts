import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { HEADER } from '../constants';
import { extractIp } from '../interceptors/audit.interceptor';

/** Ambient request facts recorded alongside auth and money mutations. */
export interface RequestContextData {
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
  correlationId: string | null;
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

    return {
      ip: extractIp(request),
      userAgent: request.headers['user-agent'] ?? null,
      deviceId: (Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader) ?? null,
      correlationId: (request.headers[HEADER.REQUEST_ID] as string | undefined) ?? null,
    };
  },
);
