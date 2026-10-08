import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer\s+([^\s]+)$/i.exec(authorization)
        : null;

    if (!match) throw new UnauthorizedException('Authentication required');

    request.user = await this.auth.authenticateAccessToken(match[1]);
    return true;
  }
}
