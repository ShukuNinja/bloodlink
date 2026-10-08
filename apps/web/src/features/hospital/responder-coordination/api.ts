import type {
  AssignResponderRequest,
  ResponderAssignmentResponse,
  ResponderResponseListResponse,
} from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Typed hospital coordination interface over D4 response references.
 * ENDPOINT/METHOD: GET responses; POST select/standby/release.
 * INPUT: BloodRequest ID, response ID, and response type.
 * OUTPUT: Shared D4 references and D3 assignment envelope.
 * AUTHORIZATION: Active membership in the BloodRequest hospital.
 * DEPENDENCIES: Shared contracts, D3 API, future D4 response integration.
 * STATE CHANGES: D3 assignment state only.
 * NON-RESPONSIBILITIES: D4 response lifecycle, matching, notifications, UI behavior.
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
