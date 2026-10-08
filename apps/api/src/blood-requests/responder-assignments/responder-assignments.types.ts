/**
 * OWNER: D3
 * PURPOSE: Hospital coordination type boundary separate from D4 response state.
 * ENDPOINT/METHOD: Select, standby, and release responder routes.
 * INPUT: BloodRequest ID, D4 response ID, and response type.
 * OUTPUT: D3 ResponderAssignment contract.
 * AUTHORIZATION: Active hospital membership in the BloodRequest organization.
 * DEPENDENCIES: D3 BloodRequest and explicit D4 response reference only.
 * STATE CHANGES: TODO(D3) assignment state only.
 * NON-RESPONSIBILITIES: Creating/mutating D4 responses, matching, notifications.
 * IMPLEMENTATION: TODO(D3).
 */
export type {
  AssignResponderRequest,
  ResponderAssignmentState,
  ResponderAssignmentView,
  ResponderResponseReference,
  ResponderResponseType,
} from '@bloodlink/contracts';
