import type { DonorResponseActionResponse } from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Mobile donor response API boundary. | ENDPOINT/METHOD: POST accept/withdraw. | INPUT: Request ID and confirmed action. | OUTPUT: DonorResponse envelope. | AUTHORIZATION: API verifies owner. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4) response only. | NON-RESPONSIBILITIES: Donation confirmation or D3 assignments. | IMPLEMENTATION: TODO(D4). */
export type DonorResponsesApi = {
  accept(id: string): Promise<DonorResponseActionResponse>;
  withdraw(id: string): Promise<DonorResponseActionResponse>;
};
