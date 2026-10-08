import { SetMetadata } from '@nestjs/common';
import type {
  OrganizationMembershipRole,
  OrganizationType,
  PlatformRole,
} from '@bloodlink/contracts';

export const ROLES_METADATA_KEY = 'bloodlink:roles';
export type ApiRole =
  PlatformRole | OrganizationType | OrganizationMembershipRole;

export const Roles = (...roles: ApiRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
