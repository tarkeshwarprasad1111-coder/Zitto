import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { HEADER } from '../constants';
import { DomainException } from '../exceptions/domain.exception';

/** RFC 7807 `application/problem+json` body. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId: string;
  /** Field-level validation failures, when applicable. */
  errors?: Array<{ path: string; message: string }>;
  /** Machine-readable domain error code, when the failure is a domain rule. */
  code?: string;
}

const PROBLEM_BASE_URI = 'https://zitto.dev/problems';

/**
 * Translates every escaping error into RFC 7807 problem+json.
 *
 * Rules:
 *  - Never leak internal messages for 5xx in production.
 *  - Always echo the correlation id so a user-reported failure is greppable.
 *  - Prisma and Zod errors get first-class, stable mappings.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers[HEADER.REQUEST_ID] as string | undefined) ?? 'unknown';
    const instance = request.originalUrl ?? request.url ?? '/';

    const problem = this.toProblem(exception, instance, correlationId);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${instance} -> ${problem.status} [${correlationId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${instance} -> ${problem.status} [${correlationId}] ${problem.detail}`,
      );
    }

    response
      .status(problem.status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(problem);
  }

  private toProblem(
    exception: unknown,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    if (exception instanceof DomainException) {
      return {
        type: `${PROBLEM_BASE_URI}/${exception.code.toLowerCase().replace(/_/g, '-')}`,
        title: exception.title,
        status: exception.status,
        detail: exception.message,
        instance,
        correlationId,
        code: exception.code,
        ...(exception.details ? { errors: exception.details } : {}),
      };
    }

    if (exception instanceof ZodError) {
      return {
        type: `${PROBLEM_BASE_URI}/validation-failed`,
        title: 'Validation Failed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'One or more fields failed validation.',
        instance,
        correlationId,
        code: 'VALIDATION_FAILED',
        errors: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, instance, correlationId);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception, instance, correlationId);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        type: `${PROBLEM_BASE_URI}/invalid-request`,
        title: 'Invalid Request',
        status: HttpStatus.BAD_REQUEST,
        detail: 'The request could not be processed against the data model.',
        instance,
        correlationId,
        code: 'PRISMA_VALIDATION',
      };
    }

    return {
      type: `${PROBLEM_BASE_URI}/internal-error`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: this.isProduction
        ? 'An unexpected error occurred. Quote the correlation id when contacting support.'
        : exception instanceof Error
          ? exception.message
          : String(exception),
      instance,
      correlationId,
      code: 'INTERNAL_ERROR',
    };
  }

  private fromHttpException(
    exception: HttpException,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    const status = exception.getStatus();
    const body = exception.getResponse();

    let detail = exception.message;
    let errors: ProblemDetails['errors'];

    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.message === 'string') {
        detail = record.message;
      } else if (Array.isArray(record.message)) {
        detail = 'One or more fields failed validation.';
        errors = (record.message as unknown[]).map((message) => ({
          path: '',
          message: String(message),
        }));
      }
      // nestjs-zod surfaces its issues under `errors`
      if (Array.isArray(record.errors)) {
        errors = (record.errors as Array<Record<string, unknown>>).map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
          message: String(issue.message ?? 'Invalid value'),
        }));
      }
    } else if (typeof body === 'string') {
      detail = body;
    }

    const title = HTTP_TITLES[status] ?? 'Error';

    return {
      type: `${PROBLEM_BASE_URI}/${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      status,
      detail,
      instance,
      correlationId,
      ...(errors ? { errors } : {}),
    };
  }

  private fromPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    const target = Array.isArray(exception.meta?.target)
      ? (exception.meta?.target as string[]).join(', ')
      : String(exception.meta?.target ?? 'record');

    switch (exception.code) {
      case 'P2002':
        return {
          type: `${PROBLEM_BASE_URI}/conflict`,
          title: 'Conflict',
          status: HttpStatus.CONFLICT,
          detail: `A record with this ${target} already exists.`,
          instance,
          correlationId,
          code: 'UNIQUE_CONSTRAINT',
        };
      case 'P2025':
        return {
          type: `${PROBLEM_BASE_URI}/not-found`,
          title: 'Not Found',
          status: HttpStatus.NOT_FOUND,
          detail: 'The requested record does not exist.',
          instance,
          correlationId,
          code: 'RECORD_NOT_FOUND',
        };
      case 'P2003':
        return {
          type: `${PROBLEM_BASE_URI}/invalid-reference`,
          title: 'Invalid Reference',
          status: HttpStatus.BAD_REQUEST,
          detail: 'A referenced record does not exist.',
          instance,
          correlationId,
          code: 'FOREIGN_KEY_CONSTRAINT',
        };
      case 'P2034':
        return {
          type: `${PROBLEM_BASE_URI}/write-conflict`,
          title: 'Write Conflict',
          status: HttpStatus.CONFLICT,
          detail: 'The operation conflicted with a concurrent write. Retry the request.',
          instance,
          correlationId,
          code: 'WRITE_CONFLICT',
        };
      default:
        return {
          type: `${PROBLEM_BASE_URI}/internal-error`,
          title: 'Internal Server Error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: this.isProduction
            ? 'A database error occurred.'
            : `Prisma ${exception.code}: ${exception.message}`,
          instance,
          correlationId,
          code: `PRISMA_${exception.code}`,
        };
    }
  }
}

const HTTP_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  423: 'Locked',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};
