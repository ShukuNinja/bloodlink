import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import {
  patientNeedListQuerySchema,
  type PatientNeedListQueryInput,
} from './patient-needs.validation';

@Controller('patient-needs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INDIVIDUAL')
export class PatientNeedsController {
  constructor(private readonly patientNeeds: PatientNeedsService) {}

  /**
   * OWNER: D2
   * ENDPOINT: POST /api/v1/patient-needs
   * PURPOSE: Create an individual PatientNeed hospital-review handoff.
   * INPUT: CreatePatientNeedRequest validated by the canonical shared schema;
   * submittedByUserId is always taken from the authenticated principal.
   * OUTPUT: PatientNeedResponse data (201).
   * AUTHORIZATION: Authenticated INDIVIDUAL; ownership is server-assigned.
   * DEPENDENCIES: Auth primitives, shared Zod schema, PatientNeedsService.
   * STATE CHANGES: Inserts one PatientNeed with PENDING_HOSPITAL_REVIEW.
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
   * PURPOSE: List the authenticated individual's own PatientNeed history.
   * INPUT: Optional page and pageSize query values parsed at the API boundary.
   * OUTPUT: PatientNeedListResponse data and PaginationMeta.
   * AUTHORIZATION: Authenticated INDIVIDUAL; results are owner-scoped in the database query.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: None.
   * NON-RESPONSIBILITIES: Hospital review queues or other users' records.
   */
  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(patientNeedListQuerySchema))
    query: PatientNeedListQueryInput,
  ) {
    return this.patientNeeds.findManyByOwner(user.id, query);
  }

  /**
   * OWNER: D2
   * ENDPOINT: GET /api/v1/patient-needs/:id
   * PURPOSE: Retrieve one PatientNeed owned by the caller.
   * INPUT: PatientNeed UUID path parameter.
   * OUTPUT: PatientNeedResponse data.
   * AUTHORIZATION: Authenticated INDIVIDUAL; ownership is enforced in the
   * database query. Another individual's record is reported as not found.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: None.
   * NON-RESPONSIBILITIES: Hospital verification or access to another user's record.
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.patientNeeds.findByOwner(user.id, id);
  }

  /**
   * OWNER: D2
   * ENDPOINT: POST /api/v1/patient-needs/:id/cancel
   * PURPOSE: Owner-requested cancellation of a pending PatientNeed.
   * INPUT: PatientNeed UUID path parameter.
   * OUTPUT: PatientNeedResponse data (200).
   * AUTHORIZATION: Authenticated INDIVIDUAL and verified record ownership.
   * DEPENDENCIES: Auth primitives, PatientNeedsService.
   * STATE CHANGES: PENDING_HOSPITAL_REVIEW -> CANCELLED via a conditional
   * transactional write; other states are rejected with 409.
   * NON-RESPONSIBILITIES: Hospital verification/rejection or downstream workflows.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.patientNeeds.cancelOwned(user.id, id);
  }
}
