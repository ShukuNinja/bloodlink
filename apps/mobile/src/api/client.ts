import type { ApiErrorCode } from '@bloodlink/contracts';
import {
  deleteStoredSession,
  readStoredSession,
  writeStoredSession,
} from './session-storage.ts';

/**
 * BloodLink mobile API transport.
 *
 * Mobile talks to the backend API only (never the database). The backend
 * origin is configured through the standard Expo `EXPO_PUBLIC_API_URL`
 * environment variable; access tokens are attached as
 * `Authorization: Bearer <JWT>`. Native sessions are stored in Expo SecureStore.
 */

const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

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

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionRestored = false;
let restoreInFlight: Promise<void> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  sessionRestored = true;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function setSessionTokens(
  nextAccessToken: string,
  nextRefreshToken: string,
): Promise<void> {
  accessToken = nextAccessToken;
  refreshToken = nextRefreshToken;
  sessionRestored = true;
  try {
    await writeStoredSession({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    });
  } catch (error) {
    accessToken = null;
    refreshToken = null;
    throw error;
  }
}

export async function clearAccessToken(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  sessionRestored = true;
  await deleteStoredSession();
}

export async function restoreSession(): Promise<void> {
  if (sessionRestored) return;
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = (async () => {
    const stored = await readStoredSession();
    accessToken = stored?.accessToken ?? null;
    refreshToken = stored?.refreshToken ?? null;
    sessionRestored = true;
    if (!stored) await deleteStoredSession();
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

/** Resets only in-memory state so a fresh app process can be simulated in tests. */
export function resetSessionMemoryForTesting(): void {
  accessToken = null;
  refreshToken = null;
  sessionRestored = false;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
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
  await restoreSession();
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
      return parseResponse<TEnvelope>(await sendRequest(method, path, options));
    }
  }
  return parseResponse<TEnvelope>(response);
}

async function sendRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
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

async function parseResponse<TEnvelope>(
  response: Response,
): Promise<TEnvelope> {
  const parsed = await parseBody(response);
  if (!response.ok) {
    throw errorFromResponse(response.status, parsed);
  }
  return parsed as TEnvelope;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const currentRefreshToken = refreshToken;
  if (!currentRefreshToken) return false;

  refreshInFlight = (async () => {
    let response: Response;
    try {
      response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
    } catch {
      throw new ApiClientError(
        0,
        'NETWORK_ERROR',
        'Unable to refresh your session. Check your connection.',
      );
    }

    const parsed = await parseBody(response);
    if (!response.ok) {
      if (response.status === 401 && refreshToken === currentRefreshToken) {
        await clearAccessToken();
        return false;
      }
      throw errorFromResponse(response.status, parsed);
    }

    const tokens = (
      parsed as
        { data?: { accessToken?: unknown; refreshToken?: unknown } } | undefined
    )?.data;
    if (
      typeof tokens?.accessToken !== 'string' ||
      typeof tokens.refreshToken !== 'string'
    ) {
      throw new ApiClientError(
        response.status,
        'MALFORMED',
        'The API returned an invalid session response.',
      );
    }
    await setSessionTokens(tokens.accessToken, tokens.refreshToken);
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
