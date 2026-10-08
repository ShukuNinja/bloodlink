import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrganizationMembershipGuard } from './guards/organization-membership.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OrganizationMembershipGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, OrganizationMembershipGuard],
})
export class AuthModule {}
