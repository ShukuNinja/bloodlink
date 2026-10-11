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
const REFRESH_TOKEN_STORAGE_KEY = 'bloodlink.refreshToken';

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
  return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function setSessionTokens(
  accessToken: string,
  refreshToken: string,
): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

export function clearSessionTokens(): void {
  clearAccessToken();
}

function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bloodlink:session-expired'));
  }
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Skip the one-time refresh retry for auth lifecycle endpoints. */
  skipRefresh?: boolean;
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
  const response = await sendRequest(method, path, options);
  if (
    response.status === 401 &&
    !options.skipRefresh &&
    ![
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
    ].includes(path)
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retry = await sendRequest(method, path, options);
      return unwrapResponse<TEnvelope>(retry);
    }
  }
  return unwrapResponse<TEnvelope>(response);
}

async function sendRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    return await fetch(buildApiUrl(path, options.query), {
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
}

function unwrapResponse<TEnvelope>(response: Response): Promise<TEnvelope> {
  return parseBody(response).then((parsed) => {
    if (!response.ok) throw errorFromResponse(response.status, parsed);
    return parsed as TEnvelope;
  });
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    if (getAccessToken()) {
      clearSessionTokens();
      notifySessionExpired();
    }
    return false;
  }

  refreshInFlight = (async () => {
    let response: Response;
    try {
      response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      throw new ApiClientError(
        0,
        'NETWORK_ERROR',
        'Unable to refresh your session. Check your connection and retry.',
      );
    }

    const parsed = await parseBody(response);
    if (!response.ok) {
      if (response.status === 401 && getRefreshToken() === refreshToken) {
        clearSessionTokens();
        notifySessionExpired();
      }
      if (response.status === 401) return false;
      throw errorFromResponse(response.status, parsed);
    }

    const authResponse = (
      parsed as
        | {
            data?: {
              accessToken?: unknown;
              refreshToken?: unknown;
            };
          }
        | undefined
    )?.data;
    if (
      typeof authResponse?.accessToken !== 'string' ||
      typeof authResponse.refreshToken !== 'string'
    ) {
      throw new ApiClientError(
        response.status,
        'MALFORMED',
        'The API returned an invalid session response.',
      );
    }
    setSessionTokens(authResponse.accessToken, authResponse.refreshToken);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
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
