import type {
  HospitalPatientNeedListResponse,
  HospitalPatientNeedQuery,
  HospitalPatientNeedResponse,
  RejectPatientNeedResponse,
  VerifyPatientNeedResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '@/api/client';

/**
 * OWNER: D3
 * PURPOSE: Typed API interface for hospital PatientNeed review.
 * ENDPOINT/METHOD: GET review list/detail; POST verify/reject.
 * INPUT: Shared query and PatientNeed ID.
 * OUTPUT: Shared review/action response envelopes.
 * AUTHORIZATION: Hospital member; API verifies active membership for the target hospital.
 * DEPENDENCIES: Shared contracts and shared API client.
 * STATE CHANGES: Verification/rejection only.
 * NON-RESPONSIBILITIES: D2 creation/cancellation, BloodRequest implementation, UI behavior.
 */
export type HospitalPatientNeedApi = {
  list(
    query?: HospitalPatientNeedQuery,
  ): Promise<HospitalPatientNeedListResponse>;
  get(id: string): Promise<HospitalPatientNeedResponse>;
  verify(id: string): Promise<VerifyPatientNeedResponse>;
  reject(id: string): Promise<RejectPatientNeedResponse>;
};

export const hospitalPatientNeedApi: HospitalPatientNeedApi = {
  list(query) {
    return apiRequest<HospitalPatientNeedListResponse>(
      'GET',
      '/hospital/patient-needs',
      {
        query: {
          status: query?.status,
          page: query?.page,
          pageSize: query?.pageSize,
        },
      },
    );
  },

  get(id) {
    return apiRequest<HospitalPatientNeedResponse>(
      'GET',
      `/hospital/patient-needs/${id}`,
    );
  },

  verify(id) {
    return apiRequest<VerifyPatientNeedResponse>(
      'POST',
      `/hospital/patient-needs/${id}/verify`,
    );
  },

  reject(id) {
    return apiRequest<RejectPatientNeedResponse>(
      'POST',
      `/hospital/patient-needs/${id}/reject`,
    );
  },
};
