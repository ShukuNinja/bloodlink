import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import {
  ROLES_METADATA_KEY,
  type ApiRole,
} from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<ApiRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user)
      throw new UnauthorizedException('Authentication required');

    for (const role of roles) {
      if (await this.auth.userHasRole(request.user, role)) return true;
    }

    throw new ForbiddenException('Insufficient permission');
  }
}
