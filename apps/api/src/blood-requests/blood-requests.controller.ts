import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AssignResponderRequest,
  BloodRequestListQuery,
} from '@bloodlink/contracts';
import {
  bloodRequestListQuerySchema,
  cancelBloodRequestSchema,
  fulfillmentConfirmSchema,
  fulfillmentStartSchema,
  releaseResponderSchema,
  selectResponderSchema,
  standbyResponderSchema,
} from '@bloodlink/validation';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { BloodRequestsService } from './blood-requests.service';
import { ResponderAssignmentsService } from './responder-assignments/responder-assignments.service';

/**
 * OWNER: D3
 * PURPOSE: Hospital-facing BloodRequest lifecycle and coordination route skeleton.
 * ENDPOINT/METHOD: GET /blood-requests[/:id][/responses], POST cancel/select/standby/release/fulfillment actions.
 * INPUT: Authenticated principal, request IDs, shared query/action contracts.
 * OUTPUT: Shared BloodRequest, D3 assignment, and D4 response-reference contracts.
 * AUTHORIZATION: HOSPITAL_ADMIN or HOSPITAL_STAFF with active membership in the owning hospital.
 * DEPENDENCIES: Existing JWT/Roles guards, shared validation, D3 services.
 * STATE CHANGES: TODO(D3); no public BloodRequest create route exists.
 * NON-RESPONSIBILITIES: D4 response mutation/generation, matching, notifications, communication, medical workflows.
 * IMPLEMENTATION: TODO(D3).
 */
@Controller('blood-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('HOSPITAL_ADMIN', 'HOSPITAL_STAFF')
export class BloodRequestsController {
  constructor(
    private readonly bloodRequests: BloodRequestsService,
    private readonly assignments: ResponderAssignmentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(bloodRequestListQuerySchema))
    query: BloodRequestListQuery,
  ) {
    return this.bloodRequests.findManyForUser(user.id, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.bloodRequests.findOneForUser(user.id, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelBloodRequestSchema)) _input?: unknown,
  ) {
    void _input;
    return this.bloodRequests.cancelForUser(user.id, id);
  }

  @Get(':id/responses')
  listResponses(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.bloodRequests.listResponseReferences(user.id, id);
  }

  @Post(':id/responders/:responseId/select')
  selectResponder(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body(new ZodValidationPipe(selectResponderSchema))
    input: AssignResponderRequest,
  ) {
    return this.assignments.select(user.id, id, responseId, input);
  }

  @Post(':id/responders/:responseId/standby')
  standbyResponder(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body(new ZodValidationPipe(standbyResponderSchema))
    input: AssignResponderRequest,
  ) {
    return this.assignments.standby(user.id, id, responseId, input);
  }

  @Post(':id/responders/:responseId/release')
  releaseResponder(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body(new ZodValidationPipe(releaseResponderSchema))
    input: AssignResponderRequest,
  ) {
    return this.assignments.release(user.id, id, responseId, input);
  }

  @Post(':id/fulfillment/start')
  startFulfillment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fulfillmentStartSchema)) _input?: unknown,
  ) {
    void _input;
    return this.bloodRequests.startFulfillment(user.id, id);
  }

  @Post(':id/fulfillment/confirm')
  confirmFulfillment(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fulfillmentConfirmSchema)) _input?: unknown,
  ) {
    void _input;
    return this.bloodRequests.confirmFulfillment(user.id, id);
  }
}
