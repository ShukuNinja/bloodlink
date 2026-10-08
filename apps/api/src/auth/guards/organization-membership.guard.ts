import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationMembershipRole } from '@bloodlink/contracts';
import { AuthService } from '../auth.service';
import { ORGANIZATION_ROLES_METADATA_KEY } from '../decorators/organization-roles.decorator';
import type { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class OrganizationMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<
      OrganizationMembershipRole[]
    >(ORGANIZATION_ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const organizationId = request.params.organizationId;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!organizationId) {
      throw new ForbiddenException('Organization membership required');
    }

    const membership = await this.auth.verifyOrganizationMembership(
      user.id,
      organizationId,
      roles,
    );
    if (!membership) {
      throw new ForbiddenException('Organization membership required');
    }

    request.organizationMembership = membership;
    return true;
  }
}
