import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CreatePatientNeedRequest } from '@bloodlink/contracts';
import { CreatePatientNeedSchema } from '@bloodlink/validation';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { PatientNeedsService } from './patient-needs.service';
import type { PatientNeedListQuery } from './patient-needs.types';

@Controller('patient-needs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INDIVIDUAL')
export class PatientNeedsController {
  constructor(private readonly patientNeeds: PatientNeedsService) {}

  /**
   * OWNER: D2
   * ENDPOINT: POST /api/v1/patient-needs
   * PURPOSE: Scaffold individual PatientNeed creation.
   * INPUT: CreatePatientNeedRequest; submittedByUserId is taken from the authenticated user.
   * OUTPUT: PatientNeedResponse data.
   * AUTHORIZATION: Authenticated INDIVIDUAL; ownership is server-assigned.
   * DEPENDENCIES: Auth primitives, shared Zod schema, PatientNeedsService.
   * STATE CHANGES: TODO(D2) create with PENDING_HOSPITAL_REVIEW.
   * NON-RESPONSIBILITIES: Hospital verification, BloodRequest creation, medical decisions.
   */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(CreatePatientNeedSchema))
    input: CreatePatientNeedRequest,
  ) {
    return this.patientNeeds.create(user.id, input);
  }

  /**
   * OWNER: D2
   * ENDPOINT: GET /api/v1/patient-needs
   * PURPOSE: Scaffold the authenticated individual's own PatientNeed history.
   * INPUT: Optional page and pageSize query values.
   * OUTPUT: PatientNeedListResponse data and pagination metadata.
   * AUTHORIZATION: Authenticated INDIVIDUAL; results must be owner-scoped.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: None.
   * NON-RESPONSIBILITIES: Hospital review queues or other users' records.
   */
  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: PatientNeedListQuery,
  ) {
    return this.patientNeeds.findManyByOwner(user.id, query);
  }

  /**
   * OWNER: D2
   * ENDPOINT: GET /api/v1/patient-needs/:id
   * PURPOSE: Scaffold retrieval of one PatientNeed owned by the caller.
   * INPUT: PatientNeed ID path parameter.
   * OUTPUT: PatientNeedResponse data.
   * AUTHORIZATION: Authenticated INDIVIDUAL; service/repository must verify ownership.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: None.
   * NON-RESPONSIBILITIES: Hospital verification or access to another user's record.
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.patientNeeds.findByOwner(user.id, id);
  }

  /**
   * OWNER: D2
   * ENDPOINT: POST /api/v1/patient-needs/:id/cancel
   * PURPOSE: Scaffold owner-requested cancellation.
   * INPUT: PatientNeed ID path parameter.
   * OUTPUT: PatientNeedResponse data.
   * AUTHORIZATION: Authenticated INDIVIDUAL and verified record ownership.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: TODO(D2) PENDING_HOSPITAL_REVIEW to CANCELLED only.
   * NON-RESPONSIBILITIES: Hospital verification/rejection or downstream workflows.
   */
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.patientNeeds.cancelOwned(user.id, id);
  }
}
