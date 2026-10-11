import type {
  HospitalSubscriptionListResponse,
  HospitalSubscriptionResponse,
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
    return apiRequest<HospitalSubscriptionListResponse>(
      'GET',
      '/hospital-subscriptions',
    );
  },
  subscribe(hospitalId: string) {
    return apiRequest<HospitalSubscriptionResponse>(
      'POST',
      `/hospitals/${encodeURIComponent(hospitalId)}/subscription`,
      { body: {} },
    );
  },
  unsubscribe(hospitalId: string) {
    return apiRequest<void>(
      'DELETE',
      `/hospitals/${encodeURIComponent(hospitalId)}/subscription`,
    );
  },
};
