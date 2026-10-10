import type {
  CreatePatientNeedRequest,
  PatientNeedListResponse,
  PatientNeedResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../../api/client';

/**
 * OWNER: D2
 * PURPOSE: PatientNeed transport for the individual mobile journey.
 * INPUT/OUTPUT: Canonical shared contracts only.
 * AUTHORIZATION: Authenticated INDIVIDUAL (token attached by the client).
 * DEPENDENCIES: Shared mobile API client, shared contracts.
 * NON-RESPONSIBILITIES: Hospital review actions (D3), BloodRequest (D3/D4).
 */
export type PatientNeedApi = {
  create(input: CreatePatientNeedRequest): Promise<PatientNeedResponse>;
  list(query?: {
    page?: number;
    pageSize?: number;
  }): Promise<PatientNeedListResponse>;
  get(id: string): Promise<PatientNeedResponse>;
  cancel(id: string): Promise<PatientNeedResponse>;
};

export const patientNeedApi: PatientNeedApi = {
  create(input) {
    return apiRequest<PatientNeedResponse>('POST', '/patient-needs', {
      body: input,
    });
  },
  list(query) {
    return apiRequest<PatientNeedListResponse>('GET', '/patient-needs', {
      query: { page: query?.page, pageSize: query?.pageSize },
    });
  },
  get(id) {
    return apiRequest<PatientNeedResponse>(
      'GET',
      `/patient-needs/${encodeURIComponent(id)}`,
    );
  },
  cancel(id) {
    return apiRequest<PatientNeedResponse>(
      'POST',
      `/patient-needs/${encodeURIComponent(id)}/cancel`,
    );
  },
};
