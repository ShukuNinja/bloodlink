import type {
  BloodRequestActionResponse,
  BloodRequestDetailResponse,
  BloodRequestListQuery,
  BloodRequestListResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '@/api/client';

/**
 * OWNER: D3
 * PURPOSE: Typed API interface for hospital BloodRequest operations.
 * ENDPOINT/METHOD: GET list/detail; POST cancel and fulfillment actions.
 * INPUT: Shared list query and BloodRequest ID.
 * OUTPUT: Shared BloodRequest response envelopes.
 * AUTHORIZATION: Active membership in the request's hospital, verified by API.
 * DEPENDENCIES: Shared contracts and shared API client.
 * STATE CHANGES: Future lifecycle actions only.
 * NON-RESPONSIBILITIES: Public creation, D4 responses, medical/fulfillment procedures.
 */
export type BloodRequestApi = {
  list(query?: BloodRequestListQuery): Promise<BloodRequestListResponse>;
  get(id: string): Promise<BloodRequestDetailResponse>;
  cancel(id: string): Promise<BloodRequestActionResponse>;
  startFulfillment(id: string): Promise<BloodRequestActionResponse>;
  confirmFulfillment(id: string): Promise<BloodRequestActionResponse>;
};

export const bloodRequestApi: BloodRequestApi = {
  list(query) {
    return apiRequest<BloodRequestListResponse>('GET', '/blood-requests', {
      query: {
        status: query?.status,
        page: query?.page,
        pageSize: query?.pageSize,
      },
    });
  },

  get(id) {
    return apiRequest<BloodRequestDetailResponse>(
      'GET',
      `/blood-requests/${id}`,
    );
  },

  cancel(id) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${id}/cancel`,
    );
  },

  startFulfillment(id) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${id}/fulfillment/start`,
    );
  },

  confirmFulfillment(id) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${id}/fulfillment/confirm`,
    );
  },
};
