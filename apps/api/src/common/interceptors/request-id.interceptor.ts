import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { HEADER } from '../constants';

/** Loose sanity check — we accept any client id that looks like a safe token. */
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Ensures every request carries a correlation id.
 *
 * An inbound `X-Request-Id` is trusted only if it looks safe (no header
 * injection, bounded length); otherwise a fresh UUID is minted. The id is written
 * back onto the request headers so downstream filters, interceptors, and the
 * audit trail all agree, and echoed on the response for the client.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const incoming = request.headers[HEADER.REQUEST_ID];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId = candidate && SAFE_ID.test(candidate) ? candidate : uuidv4();

    request.headers[HEADER.REQUEST_ID] = requestId;
    response.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}
