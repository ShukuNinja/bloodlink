import type { DonorResponseActionResponse } from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Donor response API boundary. | ENDPOINT/METHOD: POST accept/withdraw. | INPUT: BloodRequest ID and confirmed action. | OUTPUT: DonorResponse envelope. | AUTHORIZATION: API verifies donor ownership. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4) response only. | NON-RESPONSIBILITIES: Donation confirmation or D3 assignments. | IMPLEMENTATION: TODO(D4). */
export type DonorResponsesApi = {
  accept(id: string): Promise<DonorResponseActionResponse>;
  withdraw(id: string): Promise<DonorResponseActionResponse>;
};
