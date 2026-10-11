import type {
  AssignResponderRequest,
  BloodRequestActionResponse,
  BloodRequestDetailResponse,
  BloodRequestListQuery,
  BloodRequestListResponse,
  HospitalPatientNeedListResponse,
  HospitalPatientNeedQuery,
  HospitalPatientNeedResponse,
  RejectPatientNeedResponse,
  ResponderAssignmentResponse,
  ResponderResponseListResponse,
  VerifyPatientNeedResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../api/client.ts';

/** Web integration adapter for existing D3 endpoints; no D3 domain logic. */
export const hospitalApi = {
  listPatientNeeds(query?: HospitalPatientNeedQuery) {
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
  getPatientNeed(id: string) {
    return apiRequest<HospitalPatientNeedResponse>(
      'GET',
      `/hospital/patient-needs/${encodeURIComponent(id)}`,
    );
  },
  verifyPatientNeed(id: string) {
    return apiRequest<VerifyPatientNeedResponse>(
      'POST',
      `/hospital/patient-needs/${encodeURIComponent(id)}/verify`,
    );
  },
  rejectPatientNeed(id: string) {
    return apiRequest<RejectPatientNeedResponse>(
      'POST',
      `/hospital/patient-needs/${encodeURIComponent(id)}/reject`,
    );
  },
  listBloodRequests(query?: BloodRequestListQuery) {
    return apiRequest<BloodRequestListResponse>('GET', '/blood-requests', {
      query: {
        status: query?.status,
        page: query?.page,
        pageSize: query?.pageSize,
      },
    });
  },
  getBloodRequest(id: string) {
    return apiRequest<BloodRequestDetailResponse>(
      'GET',
      `/blood-requests/${encodeURIComponent(id)}`,
    );
  },
  cancelBloodRequest(id: string) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/cancel`,
      { body: {} },
    );
  },
  listResponses(id: string) {
    return apiRequest<ResponderResponseListResponse>(
      'GET',
      `/blood-requests/${encodeURIComponent(id)}/responses`,
    );
  },
  selectResponder(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/responders/${encodeURIComponent(responseId)}/select`,
      { body: input },
    );
  },
  standbyResponder(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/responders/${encodeURIComponent(responseId)}/standby`,
      { body: input },
    );
  },
  releaseResponder(
    id: string,
    responseId: string,
    input: AssignResponderRequest,
  ) {
    return apiRequest<ResponderAssignmentResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/responders/${encodeURIComponent(responseId)}/release`,
      { body: input },
    );
  },
  startFulfillment(id: string) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/fulfillment/start`,
      { body: {} },
    );
  },
  confirmFulfillment(id: string) {
    return apiRequest<BloodRequestActionResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(id)}/fulfillment/confirm`,
      { body: {} },
    );
  },
};
