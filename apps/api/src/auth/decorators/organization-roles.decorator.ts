import { SetMetadata } from '@nestjs/common';
import type { OrganizationMembershipRole } from '@bloodlink/contracts';

export const ORGANIZATION_ROLES_METADATA_KEY = 'bloodlink:organization-roles';

export const OrganizationRoles = (...roles: OrganizationMembershipRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_METADATA_KEY, roles);
