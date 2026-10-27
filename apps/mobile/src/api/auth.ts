import type {
  ApiSuccess,
  AuthResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@bloodlink/contracts';
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

export async function updateAccountName(name: string): Promise<AuthUser> {
  const envelope = await apiRequest<ApiSuccess<AuthUser>>('PATCH', '/auth/me', {
    body: { name },
  });
  return envelope.data;
}

export function signOut(): void {
  const refreshToken = getRefreshToken();
  clearAccessToken();
  if (refreshToken) {
    void apiRequest('POST', '/auth/logout', {
      body: { refreshToken },
    }).catch(() => {
      // Revocation is best-effort; local credentials have already been cleared.
    });
  }
}

export function isSignedIn(): boolean {
  return Boolean(getAccessToken());
}
