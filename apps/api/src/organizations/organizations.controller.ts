import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { OrganizationSearchRequest } from '@bloodlink/contracts';
import { organizationSearchSchema } from '@bloodlink/validation';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';

/** Search active hospitals and blood centres; caller coordinates are transient filters and are never stored or returned. */
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(organizationSearchSchema))
    input: OrganizationSearchRequest,
  ) {
    return this.organizations.search(input);
  }
}
