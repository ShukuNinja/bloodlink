import type {
  AdminAccountListResponse,
  AdminMetricsResponse,
  AdminOrganizationListResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../api/client.ts';

export const adminApi = {
  getMetrics: () => apiRequest<AdminMetricsResponse>('GET', '/admin/metrics'),
  listAccounts: (page: number) =>
    apiRequest<AdminAccountListResponse>('GET', '/admin/accounts', {
      query: { page, pageSize: 20 },
    }),
  listOrganizations: (page: number) =>
    apiRequest<AdminOrganizationListResponse>('GET', '/admin/organizations', {
      query: { page, pageSize: 20 },
    }),
};
