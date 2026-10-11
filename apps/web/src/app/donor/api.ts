import type {
  DonorBloodRequestListResponse,
  DonorBloodRequestQuery,
  DonorResponseActionResponse,
  DonorResponseListResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../api/client.ts';

export const donorApi = {
  listRequests(query: DonorBloodRequestQuery = {}) {
    return apiRequest<DonorBloodRequestListResponse>(
      'GET',
      '/donor/blood-requests',
      { query },
    );
  },
  listResponses() {
    return apiRequest<DonorResponseListResponse>('GET', '/donor/responses');
  },
  accept(requestId: string) {
    return apiRequest<DonorResponseActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(requestId)}/accept`,
      { body: {} },
    );
  },
  withdraw(requestId: string) {
    return apiRequest<DonorResponseActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(requestId)}/withdraw`,
      { body: {} },
    );
  },
};
