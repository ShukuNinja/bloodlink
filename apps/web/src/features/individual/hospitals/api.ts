import type {
  OrganizationSubscriptionListResponse,
  OrganizationSubscriptionResponse,
  HospitalSearchRequest,
  HospitalSearchResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '@/api/client';

/**
 * OWNER: D2
 * PURPOSE: Hospital discovery transport for the individual web journey.
 * INPUT: Canonical HospitalSearchRequest (transient coordinates).
 * OUTPUT: Canonical HospitalSearchResponse envelope.
 * AUTHORIZATION: Authenticated INDIVIDUAL (token attached by the client).
 * DEPENDENCIES: Shared API client, shared contracts.
 * NON-RESPONSIBILITIES: Persisting caller coordinates or direct DB access.
 */
export type HospitalDiscoveryApi = {
  search(input: HospitalSearchRequest): Promise<HospitalSearchResponse>;
};

export const hospitalDiscoveryApi: HospitalDiscoveryApi = {
  search(input) {
    return apiRequest<HospitalSearchResponse>('GET', '/hospitals', {
      query: {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
        query: input.query,
      },
    });
  },
};

export const hospitalSubscriptionApi = {
  list() {
    return apiRequest<OrganizationSubscriptionListResponse>(
      'GET',
      '/organization-subscriptions',
    );
  },
  subscribe(organizationId: string) {
    return apiRequest<OrganizationSubscriptionResponse>(
      'POST',
      `/organizations/${encodeURIComponent(organizationId)}/subscription`,
      { body: {} },
    );
  },
  unsubscribe(organizationId: string) {
    return apiRequest<void>(
      'DELETE',
      `/organizations/${encodeURIComponent(organizationId)}/subscription`,
    );
  },
};
