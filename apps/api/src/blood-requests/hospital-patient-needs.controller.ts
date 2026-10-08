import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { HospitalPatientNeedQuery } from '@bloodlink/contracts';
import { hospitalPatientNeedQuerySchema } from '@bloodlink/validation';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { HospitalPatientNeedsService } from './hospital-patient-needs.service';

/**
 * OWNER: D3
 * PURPOSE: Hospital-facing review routes over the D2-owned PatientNeed model.
 * ENDPOINT/METHOD: GET /hospital/patient-needs[/:id], POST /:id/verify, POST /:id/reject.
 * INPUT: Authenticated principal, query, and PatientNeed ID.
 * OUTPUT: Shared PatientNeed review/action contracts in the existing API envelope.
 * AUTHORIZATION: HOSPITAL_ADMIN or HOSPITAL_STAFF with active membership; service must scope to the target hospital.
 * DEPENDENCIES: Existing JWT/Roles guards, shared query schema, HospitalPatientNeedsService.
 * STATE CHANGES: TODO(D3) pending-to-verified/rejected; verification later creates one BloodRequest transactionally.
 * NON-RESPONSIBILITIES: D2 create/cancel behavior, BloodRequest lifecycle, D4 response generation.
 * IMPLEMENTATION: TODO(D3).
 */
@Controller('hospital/patient-needs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HOSPITAL_ADMIN', 'HOSPITAL_STAFF')
export class HospitalPatientNeedsController {
  constructor(private readonly service: HospitalPatientNeedsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(hospitalPatientNeedQuerySchema))
    query: HospitalPatientNeedQuery,
  ) {
    return this.service.findManyForUser(user.id, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.service.findOneForUser(user.id, id);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.service.verifyForUser(user.id, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.service.rejectForUser(user.id, id);
  }
}
