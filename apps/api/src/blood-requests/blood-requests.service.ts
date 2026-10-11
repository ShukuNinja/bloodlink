import { Injectable } from '@nestjs/common';
import type { BloodRequestListQuery } from '@bloodlink/contracts';
import { BloodRequestsRepository } from './blood-requests.repository';
import { DonationsService } from '../donations/donations.service';

/**
 * OWNER: D3
 * PURPOSE: BloodRequest hospital-side application-service boundary.
 * ENDPOINT/METHOD: GET list/detail/responses, POST cancel and fulfillment actions.
 * INPUT: Authenticated user ID, BloodRequest ID, query.
 * OUTPUT: Shared BloodRequest and D4 boundary-reference contracts.
 * AUTHORIZATION: HOSPITAL_ADMIN or HOSPITAL_STAFF; repository must enforce target organization membership.
 * DEPENDENCIES: BloodRequestsRepository and responder assignment service.
 * STATE CHANGES: Delegates lifecycle actions to the D3 repository, constrained by the documented state machine.
 * NON-RESPONSIBILITIES: Standalone create, D4 response mutation, matching, in-app alert generation, medical workflows. DonationRecord creation is delegated to D4 within the confirmation transaction.
 * IMPLEMENTATION: Application-service boundary implemented.
 */
@Injectable()
export class BloodRequestsService {
  constructor(
    private readonly repository: BloodRequestsRepository,
    private readonly donations: DonationsService,
  ) {}

  findManyForUser(userId: string, query: BloodRequestListQuery) {
    return this.repository.findManyForUser(userId, query);
  }

  findOneForUser(userId: string, bloodRequestId: string) {
    return this.repository.findOneForUser(userId, bloodRequestId);
  }

  cancelForUser(userId: string, bloodRequestId: string) {
    return this.repository.cancelForUser(userId, bloodRequestId);
  }

  listResponseReferences(userId: string, bloodRequestId: string) {
    return this.repository.listResponseReferences(userId, bloodRequestId);
  }

  startFulfillment(userId: string, bloodRequestId: string) {
    return this.repository.startFulfillment(userId, bloodRequestId);
  }

  confirmFulfillment(userId: string, bloodRequestId: string) {
    return this.repository.confirmFulfillment(
      userId,
      bloodRequestId,
      (transaction, input) =>
        this.donations.recordConfirmedDonorDonation(transaction, input),
    );
  }
}
