import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@bloodlink/contracts';
import type { ApiSuccess } from '@bloodlink/contracts';
import {
  apiRequest,
  clearAccessToken,
  getRefreshToken,
  getAccessToken,
  setSessionTokens,
} from './client.ts';

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/register',
    { body: input },
  );
  setSessionTokens(envelope.data.accessToken, envelope.data.refreshToken);
  return envelope.data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/login',
    { body: input },
  );
  setSessionTokens(envelope.data.accessToken, envelope.data.refreshToken);
  return envelope.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const envelope = await apiRequest<ApiSuccess<AuthUser>>('GET', '/auth/me');
  return envelope.data;
}

export async function signOut(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiRequest('POST', '/auth/logout', {
        body: { refreshToken },
        skipRefresh: true,
      });
    }
  } finally {
    clearAccessToken();
  }
}

export function isSignedIn(): boolean {
  return Boolean(getAccessToken());
}
