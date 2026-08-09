import type { ProblemDetail } from '@/types';

/**
 * Typed `fetch` wrapper for the Zitto REST v1 API, admin edition.
 *
 * Responsibilities:
 *  - resolve the base URL from the environment
 *  - inject the admin `Authorization` bearer and `Idempotency-Key` headers
 *  - normalise every failure into an {@link AdminApiError} carrying an RFC 7807
 *    problem document, so callers never branch on transport vs. application
 *    errors
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Normalised API failure. `problem` is always populated. */
export class AdminApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;
  readonly correlationId: string | undefined;

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title);
    this.name = 'AdminApiError';
    this.status = problem.status;
    this.problem = problem;
    this.correlationId = problem.correlationId;
  }

  /** Network failures, timeouts, rate limits and 5xx — retrying may help. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** The token is valid but the admin's role does not cover this action. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }

  /** Field-level validation messages, keyed by form field name. */
  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }
}

function problem(
  status: number,
  title: string,
  detail: string,
  type = 'about:blank',
): ProblemDetail {
  return { type, title, status, detail };
}

/** Coerce anything thrown during a request into an {@link AdminApiError}. */
export function toAdminApiError(error: unknown): AdminApiError {
  if (error instanceof AdminApiError) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AdminApiError(
      problem(408, 'Request timed out', 'The request took too long. Please try again.'),
    );
  }

  if (error instanceof TypeError) {
    return new AdminApiError(
      problem(
        0,
        'Connection failed',
        'Could not reach the API. Check your connection and try again.',
      ),
    );
  }

  return new AdminApiError(
    problem(
      500,
      'Something went wrong',
      error instanceof Error ? error.message : 'An unexpected error occurred.',
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Auth token wiring                                                   */
/* ------------------------------------------------------------------ */

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getAccessToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => undefined;

/**
 * Register how the client obtains the access token. Called once from the admin
 * auth store so this module never imports the store (which would cycle).
 */
export function registerAuthTokenGetter(getter: TokenGetter): void {
  getAccessToken = getter;
}

/** Register the callback fired on a 401, used to force a logout. */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Serialised as JSON unless it is already `FormData` or a string. */
  body?: unknown;
  /** Appended as a query string; empty and nullish values are dropped. */
  query?: Record<string, QueryValue>;
  /** Required by the API on mutating endpoints. */
  idempotencyKey?: string;
  /** Skip the `Authorization` header (login, health). */
  skipAuth?: boolean;
  /** Abort after this many milliseconds. Defaults to 20000. */
  timeoutMs?: number;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const absolute = /^https?:\/\//i.test(base) ? `${base}${suffix}` : `${base}${suffix}`;

  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${absolute}?${qs}` : absolute;
}

async function parseProblem(response: Response): Promise<ProblemDetail> {
  const correlationId =
    response.headers.get('X-Request-Id') ?? response.headers.get('x-correlation-id') ?? undefined;

  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object') {
      const raw = data as Partial<ProblemDetail>;
      return {
        type: raw.type ?? 'about:blank',
        title: raw.title ?? response.statusText ?? 'Request failed',
        status: raw.status ?? response.status,
        detail: raw.detail ?? 'The server rejected the request.',
        correlationId: raw.correlationId ?? correlationId,
        ...(raw.errors ? { errors: raw.errors } : {}),
      };
    }
  } catch {
    // Body was empty or not JSON — fall through to a synthetic problem.
  }

  return {
    type: 'about:blank',
    title: response.statusText || 'Request failed',
    status: response.status,
    detail: `The server responded with status ${response.status}.`,
    correlationId,
  };
}

/**
 * Perform a typed API request.
 *
 * @throws {AdminApiError} on any non-2xx response, network failure or timeout.
 */
export async function request<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const {
    method = 'GET',
    body,
    query,
    idempotencyKey,
    skipAuth = false,
    timeoutMs = 20_000,
    headers: extraHeaders,
    signal: externalSignal,
    ...rest
  } = options;

  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json, application/problem+json');

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      ...rest,
      method,
      headers,
      signal: controller.signal,
      body:
        body === undefined
          ? undefined
          : isFormData || typeof body === 'string'
            ? (body as BodyInit)
            : JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await parseProblem(response);
      if (detail.status === 401 && !skipAuth) onUnauthorized();
      throw new AdminApiError(detail);
    }

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return undefined as TResponse;
    }

    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('json')) {
      return (await response.text()) as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    throw toAdminApiError(error);
  } finally {
    clearTimeout(timeout);
  }
}

/** Convenience verbs. All share {@link request}'s error normalisation. */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
