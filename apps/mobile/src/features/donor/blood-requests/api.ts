import type {
  DonorBloodRequestDetailResponse,
  DonorBloodRequestListResponse,
  DonorBloodRequestQuery,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Mobile donor request API boundary. | ENDPOINT/METHOD: GET donor request list/detail. | INPUT: Shared query/request ID. | OUTPUT: Shared donor request envelopes. | AUTHORIZATION: API verifies donor profile. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Matching or precise location. | IMPLEMENTATION: TODO(D4). */
export type DonorBloodRequestsApi = {
  list(query?: DonorBloodRequestQuery): Promise<DonorBloodRequestListResponse>;
  get(id: string): Promise<DonorBloodRequestDetailResponse>;
};
