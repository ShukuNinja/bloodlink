import type {
  AssignResponderRequest,
  ResponderAssignmentResponse,
  ResponderResponseListResponse,
} from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Typed mobile API interface for hospital responder coordination.
 * ENDPOINT/METHOD: GET responses; POST select/standby/release.
 * INPUT: BloodRequest ID, response ID, and response type.
 * OUTPUT: Shared D4 references and D3 assignment envelope.
 * AUTHORIZATION: API verifies active membership and request/response association.
 * DEPENDENCIES: Shared contracts and future D4 response integration.
 * STATE CHANGES: D3 assignment state only.
 * NON-RESPONSIBILITIES: D4 response lifecycle or matching.
 * IMPLEMENTATION: TODO(D3).
 */
export type ResponderCoordinationApi = {
  listResponses(id: string): Promise<ResponderResponseListResponse>;
  select(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentResponse>;
  standby(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentResponse>;
  release(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentResponse>;
};
