/**
 * OWNER: D3
 * PURPOSE: D3 BloodRequest and D4 response-reference implementation types.
 * ENDPOINT/METHOD: BloodRequest and responder coordination routes.
 * INPUT: Shared query/action contracts and authenticated hospital user ID.
 * OUTPUT: Shared BloodRequest/assignment response types.
 * AUTHORIZATION: Active HOSPITAL_ADMIN or HOSPITAL_STAFF membership in the owning organization.
 * DEPENDENCIES: Shared contracts and D3 persistence boundary.
 * STATE CHANGES: Type declarations only.
 * NON-RESPONSIBILITIES: D4 response entities, matching, or response lifecycle.
 * IMPLEMENTATION: TODO(D3).
 */
export type {
  AssignResponderRequest,
  BloodRequestListQuery,
  BloodRequestRecord,
  ResponderAssignmentState,
  ResponderAssignmentView,
  ResponderResponseReference,
  ResponderResponseType,
} from '@bloodlink/contracts';
