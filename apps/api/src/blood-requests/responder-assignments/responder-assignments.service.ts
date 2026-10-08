import { Injectable } from '@nestjs/common';
import type { AssignResponderRequest } from '@bloodlink/contracts';
import { ResponderAssignmentsRepository } from './responder-assignments.repository';

/**
 * OWNER: D3
 * PURPOSE: Application-service boundary for hospital assignment decisions.
 * ENDPOINT/METHOD: Select, standby, and release responder routes.
 * INPUT: Authenticated user, BloodRequest ID, response ID/type.
 * OUTPUT: Shared assignment contract.
 * AUTHORIZATION: Active hospital membership and response/request association.
 * DEPENDENCIES: ResponderAssignmentsRepository and D4 response-reference boundary.
 * STATE CHANGES: TODO(D3) assignment state only.
 * NON-RESPONSIBILITIES: D4 response lifecycle, matching, notifications, fulfillment.
 * IMPLEMENTATION: TODO(D3).
 */
@Injectable()
export class ResponderAssignmentsService {
  constructor(private readonly repository: ResponderAssignmentsRepository) {}

  select(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return this.repository.select(userId, bloodRequestId, responseId, input);
  }

  standby(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return this.repository.standby(userId, bloodRequestId, responseId, input);
  }

  release(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return this.repository.release(userId, bloodRequestId, responseId, input);
  }
}
