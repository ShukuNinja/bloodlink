import type {
  DonorProfileResponse,
  DonorProfileUpdate,
  DonorProfileUpdateResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Mobile donor profile API boundary. | ENDPOINT/METHOD: GET/PATCH /api/v1/donor-profile. | INPUT: Shared profile update. | OUTPUT: Shared envelopes. | AUTHORIZATION: API verifies owner. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4). | NON-RESPONSIBILITIES: Local persistence or medical eligibility. | IMPLEMENTATION: TODO(D4). */
export type DonorProfileApi = {
  get(): Promise<DonorProfileResponse>;
  update(input: DonorProfileUpdate): Promise<DonorProfileUpdateResponse>;
};
