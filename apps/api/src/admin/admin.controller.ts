import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminRecordListQuery } from '@bloodlink/contracts';
import { adminRecordListQuerySchema } from '@bloodlink/validation';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('metrics')
  getMetrics() {
    return this.admin.getMetrics();
  }

  @Get('accounts')
  listAccounts(
    @Query(new ZodValidationPipe(adminRecordListQuerySchema))
    query: AdminRecordListQuery,
  ) {
    return this.admin.listAccounts(query);
  }

  @Get('organizations')
  listOrganizations(
    @Query(new ZodValidationPipe(adminRecordListQuerySchema))
    query: AdminRecordListQuery,
  ) {
    return this.admin.listOrganizations(query);
  }
}
