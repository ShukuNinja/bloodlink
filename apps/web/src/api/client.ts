import type { ApiErrorCode } from '@bloodlink/contracts';

/**
 * BloodLink web API transport.
 *
 * All calls go through the same-origin `/api/v1` prefix (the Next.js dev
 * server proxies it to the backend), use the canonical `{ data }` /
 * `{ data, meta }` success envelopes, and surface failures as ApiClientError
 * instances built from the canonical `{ error }` envelope. Access tokens are
 * attached as `Authorization: Bearer <JWT>`.
 */

export const API_BASE_URL = '/api/v1';
const ACCESS_TOKEN_STORAGE_KEY = 'bloodlink.accessToken';

export type ApiClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'MALFORMED';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiClientErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiClientErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
}

export function buildApiUrl(
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `${url}?${encoded}` : url;
}

export async function apiRequest<TEnvelope>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: ApiRequestOptions = {},
): Promise<TEnvelope> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, options.query), {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the BloodLink API. Check your connection.',
    );
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw errorFromResponse(response.status, parsed);
  }
  return parsed as TEnvelope;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function errorFromResponse(
  status: number,
  body: unknown,
): ApiClientError {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error?: unknown }).error === 'object' &&
    (body as { error: object }).error !== null
  ) {
    const error = (body as { error: Record<string, unknown> }).error;
    const code = typeof error.code === 'string' ? error.code : 'MALFORMED';
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : 'Request failed';
    return new ApiClientError(
      status,
      code as ApiClientErrorCode,
      message,
      error.details,
    );
  }

  return new ApiClientError(status, 'MALFORMED', 'Request failed');
}

/** Field-level validation issues extracted from a VALIDATION_ERROR response. */
export function validationIssues(
  error: unknown,
): Array<{ path: string; code: string }> {
  if (!(error instanceof ApiClientError) || error.code !== 'VALIDATION_ERROR') {
    return [];
  }
  const details = error.details as
    { issues?: Array<{ path?: string[]; code?: string }> } | undefined;
  return (details?.issues ?? []).map((issue) => ({
    path: (issue.path ?? []).join('.'),
    code: issue.code ?? 'invalid',
  }));
}
