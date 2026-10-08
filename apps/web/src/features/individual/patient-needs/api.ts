import type {
  CreatePatientNeedRequest,
  PatientNeedListResponse,
  PatientNeedResponse,
} from '@bloodlink/contracts';

// TODO(D2): Implement these operations through the shared API client.
export type PatientNeedApi = {
  create(input: CreatePatientNeedRequest): Promise<PatientNeedResponse>;
  list(query?: {
    page?: number;
    pageSize?: number;
  }): Promise<PatientNeedListResponse>;
  get(id: string): Promise<PatientNeedResponse>;
  cancel(id: string): Promise<PatientNeedResponse>;
};
