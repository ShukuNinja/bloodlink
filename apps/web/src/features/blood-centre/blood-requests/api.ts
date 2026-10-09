import type {
  BloodRequestDetailResponse,
  BloodRequestListQuery,
  BloodRequestListResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Blood-centre request API boundary. | ENDPOINT/METHOD: GET blood-centre request list/detail. | INPUT: Shared query/request ID. | OUTPUT: Shared BloodRequest envelopes. | AUTHORIZATION: API verifies active blood-centre membership. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Inventory or matching. | IMPLEMENTATION: TODO(D4). */
export type BloodCentreRequestsApi = {
  list(query?: BloodRequestListQuery): Promise<BloodRequestListResponse>;
  get(id: string): Promise<BloodRequestDetailResponse>;
};
