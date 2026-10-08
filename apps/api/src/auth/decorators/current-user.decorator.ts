import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedPrincipal,
  AuthenticatedRequest,
} from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user!,
);
