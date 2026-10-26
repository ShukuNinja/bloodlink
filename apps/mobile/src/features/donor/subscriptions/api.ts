import type {
  OrganizationSubscriptionListResponse,
  OrganizationSubscriptionResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Mobile donor hospital-network API boundary. | ENDPOINT/METHOD: GET/POST/DELETE subscriptions. | INPUT: Hospital ID. | OUTPUT: Shared subscription envelopes. | AUTHORIZATION: API verifies donor/hospital relationship. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4). | NON-RESPONSIBILITIES: Push device subscriptions. | IMPLEMENTATION: TODO(D4). */
export type DonorSubscriptionsApi = {
  list(): Promise<OrganizationSubscriptionListResponse>;
  subscribe(organizationId: string): Promise<OrganizationSubscriptionResponse>;
  unsubscribe(organizationId: string): Promise<void>;
};
