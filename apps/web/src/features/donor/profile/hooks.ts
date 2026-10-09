import type { DonorProfileApi } from './api';
/** OWNER: D4 | PURPOSE: Donor profile hook boundary. | ENDPOINT/METHOD: Profile query/update. | INPUT: Existing API client. | OUTPUT: TODO(D4) hook contract. | AUTHORIZATION: API-enforced owner. | DEPENDENCIES: DonorProfileApi and shared UI system. | STATE CHANGES: None in scaffold. | NON-RESPONSIBILITIES: UI behavior or local domain models. | IMPLEMENTATION: TODO(D4). */
export type DonorProfileHooks = { api: DonorProfileApi };
