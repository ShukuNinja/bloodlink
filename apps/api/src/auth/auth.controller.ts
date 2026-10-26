import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type {
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '@bloodlink/contracts';
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
  updateAccountNameSchema,
} from '@bloodlink/validation';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from './auth.types';
import { ZodValidationPipe } from '../http/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerInputSchema)) input: RegisterInput,
  ) {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginInputSchema)) input: LoginInput) {
    return this.auth.login(input);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshInputSchema)) input: RefreshInput,
  ) {
    return this.auth.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body(new ZodValidationPipe(logoutInputSchema)) input: LogoutInput) {
    return this.auth.logout(input.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.auth.toAuthUser(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateAccountName(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(updateAccountNameSchema))
    input: { name: string },
  ) {
    return this.auth.updateAccountName(user.id, input.name);
  }
}
