import type {
  BloodRequestListQuery,
  BloodRequestListResponse,
  OrganizationResponseActionResponse,
  OrganizationResponseListResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../api/client.ts';

export const bloodCentreApi = {
  listResponses() {
    return apiRequest<OrganizationResponseListResponse>(
      'GET',
      '/blood-centre/responses',
    );
  },
  listRequests(query: BloodRequestListQuery = {}) {
    return apiRequest<BloodRequestListResponse>(
      'GET',
      '/blood-centre/blood-requests',
      { query },
    );
  },
  respond(requestId: string) {
    return apiRequest<OrganizationResponseActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(requestId)}/organization-response`,
      { body: {} },
    );
  },
  withdraw(requestId: string) {
    return apiRequest<OrganizationResponseActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(requestId)}/organization-response/withdraw`,
      { body: {} },
    );
  },
};
