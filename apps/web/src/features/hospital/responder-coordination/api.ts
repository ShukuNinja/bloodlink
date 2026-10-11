import type {
  AssignResponderRequest,
  ResponderAssignmentResponse,
  ResponderResponseListResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '@/api/client';

/**
 * OWNER: D3
 * PURPOSE: Typed hospital coordination interface over D4 response references.
 * ENDPOINT/METHOD: GET responses; POST select/standby/release.
 * INPUT: BloodRequest ID, response ID, and response type.
 * OUTPUT: Shared D4 references and D3 assignment envelope.
 * AUTHORIZATION: Active membership in the BloodRequest hospital.
 * DEPENDENCIES: Shared contracts and shared API client.
 * STATE CHANGES: D3 assignment state only.
 * NON-RESPONSIBILITIES: D4 response lifecycle, matching, notifications, UI behavior.
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

export const responderCoordinationApi: ResponderCoordinationApi = {
  listResponses(id) {
    return apiRequest<ResponderResponseListResponse>(
      'GET',
      `/blood-requests/${id}/responses`,
    );
  },

  select(id, responseId, input) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${id}/responders/${responseId}/select`,
      { body: input },
    );
  },

  standby(id, responseId, input) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${id}/responders/${responseId}/standby`,
      { body: input },
    );
  },

  release(id, responseId, input) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${id}/responders/${responseId}/release`,
      { body: input },
    );
  },
};
