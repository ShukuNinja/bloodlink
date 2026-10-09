import type {
  DonorBloodRequestDetailResponse,
  DonorBloodRequestListResponse,
  DonorBloodRequestQuery,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Donor BloodRequest API boundary. | ENDPOINT/METHOD: GET donor request list/detail. | INPUT: Shared query and request ID. | OUTPUT: Shared donor request envelopes. | AUTHORIZATION: API verifies donor profile and availability. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Matching or exposing donor coordinates. | IMPLEMENTATION: TODO(D4). */
export type DonorBloodRequestsApi = {
  list(query?: DonorBloodRequestQuery): Promise<DonorBloodRequestListResponse>;
  get(id: string): Promise<DonorBloodRequestDetailResponse>;
};
