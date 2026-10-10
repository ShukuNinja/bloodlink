import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { HospitalSearchRequest } from '@bloodlink/contracts';
import { hospitalSearchSchema } from '@bloodlink/validation';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { HospitalsService } from './hospitals.service';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INDIVIDUAL')
export class HospitalsController {
  constructor(private readonly hospitals: HospitalsService) {}

  /**
   * OWNER: D2
   * ENDPOINT: GET /api/v1/hospitals
   * PURPOSE: Nearby hospital discovery for PatientNeed hospital selection.
   * INPUT: Transient latitude/longitude; optional radiusMeters and query,
   * validated by the canonical shared hospitalSearchSchema.
   * OUTPUT: HospitalSearchResponse with discovery-safe HospitalSummary items.
   * AUTHORIZATION: Authenticated INDIVIDUAL.
   * DEPENDENCIES: Shared search validation, Auth primitives, HospitalsService, PostGIS.
   * STATE CHANGES: None; caller coordinates are transient and never persisted.
   * NON-RESPONSIBILITIES: Staff/membership data, donor location, district boundaries, medical decisions.
   */
  @Get()
  search(
    @Query(new ZodValidationPipe(hospitalSearchSchema))
    input: HospitalSearchRequest,
  ) {
    return this.hospitals.search(input);
  }
}
