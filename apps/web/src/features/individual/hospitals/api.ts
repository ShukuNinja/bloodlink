import type {
  HospitalSearchRequest,
  HospitalSearchResponse,
} from '@bloodlink/contracts';

// TODO(D2): Implement discovery through the shared API client.
export type HospitalDiscoveryApi = {
  search(input: HospitalSearchRequest): Promise<HospitalSearchResponse>;
};
