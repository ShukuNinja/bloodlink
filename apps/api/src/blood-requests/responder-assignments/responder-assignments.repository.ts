import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AssignResponderRequest } from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Scaffold persistence for D3-owned responder assignments.
 * ENDPOINT/METHOD: Select, standby, release operations.
 * INPUT: Authenticated user, BloodRequest ID, response ID/type.
 * OUTPUT: Shared ResponderAssignmentView.
 * AUTHORIZATION: Verify active membership in the BloodRequest hospital and response belongs to that request.
 * DEPENDENCIES: Central PrismaService, BloodRequest, ResponderAssignment, deferred D4 response tables.
 * STATE CHANGES: TODO(D3) assignment only; never mutate D4 response state.
 * NON-RESPONSIBILITIES: Matching, response generation, notification, D4 lifecycle changes.
 * IMPLEMENTATION: TODO(D3).
 */
@Injectable()
export class ResponderAssignmentsRepository {
  async select(
    _userId: string,
    _bloodRequestId: string,
    _responseId: string,
    _input: AssignResponderRequest,
  ): Promise<never> {
    void _userId;
    void _bloodRequestId;
    void _responseId;
    void _input;
    throw new NotImplementedException('TODO(D3): select responder');
  }

  async standby(
    _userId: string,
    _bloodRequestId: string,
    _responseId: string,
    _input: AssignResponderRequest,
  ): Promise<never> {
    void _userId;
    void _bloodRequestId;
    void _responseId;
    void _input;
    throw new NotImplementedException('TODO(D3): place responder on standby');
  }

  async release(
    _userId: string,
    _bloodRequestId: string,
    _responseId: string,
    _input: AssignResponderRequest,
  ): Promise<never> {
    void _userId;
    void _bloodRequestId;
    void _responseId;
    void _input;
    throw new NotImplementedException('TODO(D3): release responder');
  }
}
