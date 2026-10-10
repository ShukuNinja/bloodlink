import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  BloodRequestListQuery,
  CreateMessageRequest,
  DonorBloodRequestQuery,
  DonorProfileUpdate,
} from '@bloodlink/contracts';
import {
  createMessageSchema,
  donorAcceptSchema,
  donorBloodRequestQuerySchema,
  donorProfileUpdateSchema,
  donorWithdrawSchema,
  bloodRequestListQuerySchema,
  hospitalSubscriptionSchema,
  organizationResponseSchema,
} from '@bloodlink/validation';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../http/zod-validation.pipe';
import { D4ScaffoldService } from './d4-scaffold.service';

/**
 * OWNER: D4
 * PURPOSE: Guarded route skeletons for donor, blood-centre, subscription, and request communication operations.
 * ENDPOINT/METHOD: D4 routes under /api/v1.
 * INPUT: Authenticated user, route IDs, and shared validated inputs.
 * OUTPUT: Contract envelopes ({data}/{error}) via the API response interceptor.
 * AUTHORIZATION: Individual roles, active blood-centre membership, or authenticated request participants as specified per route.
 * DEPENDENCIES: Existing JWT/Roles guards, shared contracts/validation, D4ScaffoldService and the D4 sub-domain services.
 * STATE CHANGES: D4-owned records only (profiles, responses, subscriptions, conversations, messages).
 * NON-RESPONSIBILITIES: BloodRequest lifecycle, ResponderAssignment state, medical eligibility, inventory, or delivery.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class D4Controller {
  constructor(private readonly d4: D4ScaffoldService) {}

  /** OWNER: D4 | ENDPOINT: GET /donor-profile | PURPOSE: Read own profile. | INPUT: Authenticated user. | OUTPUT: DonorProfile. | AUTHORIZATION: INDIVIDUAL owner. | DEPENDENCIES: D4 profile service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Exposing coordinates or medical eligibility.. */
  @Get('donor-profile') @Roles('INDIVIDUAL') getProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.d4.getDonorProfile(user.id);
  }

  /** OWNER: D4 | ENDPOINT: PATCH /donor-profile | PURPOSE: Update own coordination profile. | INPUT: Shared profile update schema. | OUTPUT: DonorProfile. | AUTHORIZATION: INDIVIDUAL owner. | DEPENDENCIES: D4 profile service and validation. | STATE CHANGES: D4 records only. | NON-RESPONSIBILITIES: Medical eligibility decisions.. */
  @Patch('donor-profile') @Roles('INDIVIDUAL') updateProfile(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body(new ZodValidationPipe(donorProfileUpdateSchema))
    input: DonorProfileUpdate,
  ) {
    return this.d4.updateDonorProfile(user.id, input);
  }

  /** OWNER: D4 | ENDPOINT: GET /donor/blood-requests | PURPOSE: List requests available to the donor. | INPUT: Donor query. | OUTPUT: Donor request list. | AUTHORIZATION: INDIVIDUAL with active donor profile. | DEPENDENCIES: Matching boundary and D4 service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Candidate matching implementation.. */
  @Get('donor/blood-requests') @Roles('INDIVIDUAL') listDonorRequests(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(donorBloodRequestQuerySchema))
    query: DonorBloodRequestQuery,
  ) {
    return this.d4.listDonorRequests(user.id, query);
  }

  /** OWNER: D4 | ENDPOINT: GET /donor/blood-requests/:id | PURPOSE: Read one request offered to the donor. | INPUT: Request ID. | OUTPUT: Donor request detail. | AUTHORIZATION: INDIVIDUAL with active donor profile. | DEPENDENCIES: D4 service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Donor location disclosure.. */
  @Get('donor/blood-requests/:id') @Roles('INDIVIDUAL') getDonorRequest(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.d4.getDonorRequest(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /blood-requests/:id/accept | PURPOSE: Record confirmed donor acceptance. | INPUT: Request ID and confirmation action. | OUTPUT: DonorResponse. | AUTHORIZATION: Authenticated donor profile owner. | DEPENDENCIES: D4 response boundary. | STATE CHANGES: D4 response rows only. | NON-RESPONSIBILITIES: Donation confirmation/history or D3 assignment state.. */
  @HttpCode(HttpStatus.OK)
  @Post('blood-requests/:id/accept')
  @Roles('INDIVIDUAL')
  accept(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(donorAcceptSchema)) _input?: unknown,
  ) {
    void _input;
    return this.d4.acceptRequest(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /blood-requests/:id/withdraw | PURPOSE: Withdraw own response. | INPUT: Request ID. | OUTPUT: DonorResponse. | AUTHORIZATION: Donor response owner. | DEPENDENCIES: D4 response service. | STATE CHANGES: D4 response rows only. | NON-RESPONSIBILITIES: D3 assignment mutation.. */
  @HttpCode(HttpStatus.OK)
  @Post('blood-requests/:id/withdraw')
  @Roles('INDIVIDUAL')
  withdraw(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(donorWithdrawSchema)) _input?: unknown,
  ) {
    void _input;
    return this.d4.withdrawRequest(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: GET /blood-centre/blood-requests | PURPOSE: List requests for a blood-centre member. | INPUT: Shared request query. | OUTPUT: BloodRequest list. | AUTHORIZATION: Active BLOOD_CENTRE_ADMIN or BLOOD_CENTRE_STAFF membership. | DEPENDENCIES: Existing RBAC and D4 service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Inventory or matching.. */
  @Get('blood-centre/blood-requests')
  @Roles('BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF')
  listCentreRequests(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(bloodRequestListQuerySchema))
    query: BloodRequestListQuery,
  ) {
    return this.d4.listBloodCentreRequests(user.id, query);
  }

  /** OWNER: D4 | ENDPOINT: GET /blood-centre/blood-requests/:id | PURPOSE: Read an offered request. | INPUT: Request ID. | OUTPUT: BloodRequest detail. | AUTHORIZATION: Active blood-centre membership. | DEPENDENCIES: Existing RBAC and D4 service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Inventory data.. */
  @Get('blood-centre/blood-requests/:id')
  @Roles('BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF')
  getCentreRequest(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.d4.getBloodCentreRequest(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /blood-requests/:id/organization-response | PURPOSE: Create/update blood-centre response. | INPUT: Request ID and empty structural action. | OUTPUT: OrganizationResponse. | AUTHORIZATION: ACTIVE membership in an ACTIVE BLOOD_CENTRE organization, verified server-side. | DEPENDENCIES: D4 response service. | STATE CHANGES: D4 response rows only. | NON-RESPONSIBILITIES: BloodRequest or assignment mutation.. */
  @HttpCode(HttpStatus.OK)
  @Post('blood-requests/:id/organization-response')
  @Roles('BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF')
  organizationResponse(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(organizationResponseSchema)) _input?: unknown,
  ) {
    void _input;
    return this.d4.createOrganizationResponse(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /blood-requests/:id/organization-response/withdraw | PURPOSE: Withdraw the caller's blood-centre response. | INPUT: Request ID. | OUTPUT: OrganizationResponse. | AUTHORIZATION: ACTIVE membership in the responding ACTIVE BLOOD_CENTRE. | STATE CHANGES: Response -> WITHDRAWN only. | NON-RESPONSIBILITIES: D3 assignment mutation. */
  @HttpCode(HttpStatus.OK)
  @Post('blood-requests/:id/organization-response/withdraw')
  @Roles('BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF')
  withdrawOrganizationResponse(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(organizationResponseSchema)) _input?: unknown,
  ) {
    void _input;
    return this.d4.withdrawOrganizationResponse(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /hospitals/:id/subscription | PURPOSE: Subscribe donor to a hospital network. | INPUT: Hospital ID. | OUTPUT: HospitalSubscription. | AUTHORIZATION: Donor owner; hospital relationship checked server-side. | DEPENDENCIES: D4 subscriptions. | STATE CHANGES: D4 records only. | NON-RESPONSIBILITIES: Push device subscription.. */
  @HttpCode(HttpStatus.CREATED)
  @Post('hospitals/:id/subscription')
  @Roles('INDIVIDUAL')
  subscribe(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(hospitalSubscriptionSchema)) _input?: unknown,
  ) {
    void _input;
    return this.d4.subscribe(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: DELETE /hospitals/:id/subscription | PURPOSE: Remove own hospital network subscription. | INPUT: Hospital ID. | OUTPUT: 204. | AUTHORIZATION: Donor owner; hospital relationship checked server-side. | DEPENDENCIES: D4 subscriptions. | STATE CHANGES: D4 records only. | NON-RESPONSIBILITIES: Push device subscription.. */
  @Delete('hospitals/:id/subscription') @Roles('INDIVIDUAL') unsubscribe(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.d4.unsubscribe(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: GET /hospital-subscriptions | PURPOSE: List current donor's hospital networks. | INPUT: Authenticated user. | OUTPUT: Subscription list. | AUTHORIZATION: INDIVIDUAL owner. | DEPENDENCIES: D4 subscriptions. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Device push subscriptions.. */
  @Get('hospital-subscriptions') @Roles('INDIVIDUAL') listSubscriptions(
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.d4.listSubscriptions(user.id);
  }

  /** OWNER: D4 | ENDPOINT: GET /blood-requests/:id/conversation | PURPOSE: Read request-scoped hospital/responder conversation. | INPUT: Request ID. | OUTPUT: Conversation. | AUTHORIZATION: Authorized request participant. | DEPENDENCIES: D4 communication service. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Generic chat.. */
  @Get('blood-requests/:id/conversation') getConversation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.d4.getConversation(user.id, id);
  }

  /** OWNER: D4 | ENDPOINT: POST /blood-requests/:id/messages | PURPOSE: Send request-scoped message. | INPUT: Validated message content. | OUTPUT: Message. | AUTHORIZATION: Authorized conversation participant. | DEPENDENCIES: Shared contracts/validation and D4 communication service. | STATE CHANGES: D4 records only. | NON-RESPONSIBILITIES: Generic chat or patient-identifying notification payloads.. */
  @HttpCode(HttpStatus.OK)
  @Post('blood-requests/:id/messages')
  createMessage(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createMessageSchema))
    input: CreateMessageRequest,
  ) {
    return this.d4.createMessage(user.id, id, input);
  }
}
