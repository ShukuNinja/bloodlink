import type { PlatformRole, UserStatus } from '@bloodlink/contracts';

export type AuthenticatedPrincipal = {
  id: string;
  name: string | null;
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
