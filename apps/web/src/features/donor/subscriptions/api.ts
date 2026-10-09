import type {
  HospitalSubscriptionListResponse,
  HospitalSubscriptionResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Voluntary hospital-network subscription API boundary. | ENDPOINT/METHOD: POST/DELETE hospital subscription and GET list. | INPUT: Hospital ID. | OUTPUT: Shared subscription envelopes. | AUTHORIZATION: API verifies donor/hospital relationship. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4). | NON-RESPONSIBILITIES: Push device subscriptions. | IMPLEMENTATION: TODO(D4). */
export type DonorSubscriptionsApi = {
  list(): Promise<HospitalSubscriptionListResponse>;
  subscribe(hospitalId: string): Promise<HospitalSubscriptionResponse>;
  unsubscribe(hospitalId: string): Promise<void>;
};
