import type {
  BloodRequestActionResponse,
  BloodRequestDetailResponse,
  BloodRequestListQuery,
  BloodRequestListResponse,
} from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Typed mobile API interface for hospital BloodRequest operations.
 * ENDPOINT/METHOD: GET list/detail; POST cancel and fulfillment actions.
 * INPUT: Shared list query and BloodRequest ID.
 * OUTPUT: Shared BloodRequest response envelopes.
 * AUTHORIZATION: API verifies active membership in the request hospital.
 * DEPENDENCIES: Shared contracts and future shared API client.
 * STATE CHANGES: Future lifecycle actions only.
 * NON-RESPONSIBILITIES: Public creation or medical/fulfillment procedures.
 * IMPLEMENTATION: TODO(D3).
 */
export type BloodRequestApi = {
  list(query?: BloodRequestListQuery): Promise<BloodRequestListResponse>;
  get(id: string): Promise<BloodRequestDetailResponse>;
  cancel(id: string): Promise<BloodRequestActionResponse>;
  startFulfillment(id: string): Promise<BloodRequestActionResponse>;
  confirmFulfillment(id: string): Promise<BloodRequestActionResponse>;
};
