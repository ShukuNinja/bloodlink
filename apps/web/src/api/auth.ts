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
  getAccessToken,
  setAccessToken,
} from './client';

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/register',
    { body: input },
  );
  setAccessToken(envelope.data.accessToken);
  return envelope.data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const envelope = await apiRequest<ApiSuccess<AuthResponse>>(
    'POST',
    '/auth/login',
    { body: input },
  );
  setAccessToken(envelope.data.accessToken);
  return envelope.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const envelope = await apiRequest<ApiSuccess<AuthUser>>('GET', '/auth/me');
  return envelope.data;
}

export function signOut(): void {
  clearAccessToken();
}

export function isSignedIn(): boolean {
  return Boolean(getAccessToken());
}
