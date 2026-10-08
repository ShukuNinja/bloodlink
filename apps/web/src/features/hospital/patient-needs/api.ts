import type {
  HospitalPatientNeedListResponse,
  HospitalPatientNeedQuery,
  HospitalPatientNeedResponse,
  RejectPatientNeedResponse,
  VerifyPatientNeedResponse,
} from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Typed API interface for hospital PatientNeed review.
 * ENDPOINT/METHOD: GET review list/detail; POST verify/reject.
 * INPUT: Shared query and PatientNeed ID.
 * OUTPUT: Shared review/action response envelopes.
 * AUTHORIZATION: Hospital member; API verifies active membership for the target hospital.
 * DEPENDENCIES: Shared contracts and future shared API client.
 * STATE CHANGES: Verification/rejection only.
 * NON-RESPONSIBILITIES: D2 creation/cancellation, BloodRequest implementation, UI behavior.
 * IMPLEMENTATION: TODO(D3).
 */
export type HospitalPatientNeedApi = {
  list(
    query?: HospitalPatientNeedQuery,
  ): Promise<HospitalPatientNeedListResponse>;
  get(id: string): Promise<HospitalPatientNeedResponse>;
  verify(id: string): Promise<VerifyPatientNeedResponse>;
  reject(id: string): Promise<RejectPatientNeedResponse>;
};
