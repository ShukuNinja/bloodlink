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
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from './client';

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/register',
    { body: input },
  );
  await setSessionTokens(envelope.data.accessToken, envelope.data.refreshToken);
  return envelope.data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/login',
    { body: input },
  );
  await setSessionTokens(envelope.data.accessToken, envelope.data.refreshToken);
  return envelope.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const envelope = await apiRequest<ApiSuccess<AuthUser>>('GET', '/auth/me');
  return envelope.data;
}

export async function signOut(): Promise<void> {
  const token = getRefreshToken();
  try {
    if (token) {
      await apiRequest('POST', '/auth/logout', {
        body: { refreshToken: token },
        skipRefresh: true,
      });
    }
  } finally {
    await clearAccessToken();
  }
}

export function isSignedIn(): boolean {
  return Boolean(getAccessToken());
}
