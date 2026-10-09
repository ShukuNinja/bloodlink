import type { DonorResponsesApi } from './api';
/** OWNER: D4 | PURPOSE: Mobile donor response hook boundary. | ENDPOINT/METHOD: Accept/withdraw. | INPUT: Existing API client. | OUTPUT: TODO(D4) hook contract. | AUTHORIZATION: API enforced. | DEPENDENCIES: DonorResponsesApi. | STATE CHANGES: None. | NON-RESPONSIBILITIES: D3 coordination. | IMPLEMENTATION: TODO(D4). */
export type DonorResponseHooks = { api: DonorResponsesApi };
