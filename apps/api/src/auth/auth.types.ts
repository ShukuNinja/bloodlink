import type { PlatformRole, UserStatus } from '@bloodlink/contracts';

export type AuthenticatedPrincipal = {
  id: string;
  email: string;
  status: UserStatus;
  role: PlatformRole;
};

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  body?: unknown;
  user?: AuthenticatedPrincipal;
  organizationMembership?: unknown;
};
