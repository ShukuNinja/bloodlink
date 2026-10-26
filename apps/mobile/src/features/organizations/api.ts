import type {
  OrganizationSearchRequest,
  OrganizationSearchResponse,
  OrganizationConversationListResponse,
  OrganizationConversationResponse,
  CreateMessageRequest,
  MessageResponse,
  PatientNeedConversationListResponse,
  PatientNeedConversationResponse,
  OrganizationSubscriptionListResponse,
  OrganizationSubscriptionResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '../../api/client';

export const organizationsApi = {
  search(input: OrganizationSearchRequest) {
    return apiRequest<OrganizationSearchResponse>('GET', '/organizations', {
      query: input,
    });
  },
  listSubscriptions() {
    return apiRequest<OrganizationSubscriptionListResponse>(
      'GET',
      '/organization-subscriptions',
    );
  },
  subscribe(organizationId: string) {
    return apiRequest<OrganizationSubscriptionResponse>(
      'POST',
      `/organizations/${encodeURIComponent(organizationId)}/subscription`,
      { body: {} },
    );
  },
  unsubscribe(organizationId: string) {
    return apiRequest<void>(
      'DELETE',
      `/organizations/${encodeURIComponent(organizationId)}/subscription`,
    );
  },
  listConversations() {
    return apiRequest<OrganizationConversationListResponse>(
      'GET',
      '/organization-conversations',
    );
  },
  openConversation(targetId: string, sourceOrganizationId: string) {
    return apiRequest<OrganizationConversationResponse>(
      'POST',
      `/organizations/${encodeURIComponent(targetId)}/conversations`,
      { body: { sourceOrganizationId } },
    );
  },
  conversation(id: string) {
    return apiRequest<OrganizationConversationResponse>(
      'GET',
      `/organization-conversations/${encodeURIComponent(id)}`,
    );
  },
  sendMessage(id: string, input: CreateMessageRequest) {
    return apiRequest<MessageResponse>(
      'POST',
      `/organization-conversations/${encodeURIComponent(id)}/messages`,
      { body: input },
    );
  },
  listPatientNeedConversations() {
    return apiRequest<PatientNeedConversationListResponse>(
      'GET',
      '/patient-need-conversations',
    );
  },
  patientNeedConversation(patientNeedId: string) {
    return apiRequest<PatientNeedConversationResponse>(
      'GET',
      `/patient-needs/${encodeURIComponent(patientNeedId)}/conversation`,
    );
  },
  sendPatientNeedMessage(patientNeedId: string, input: CreateMessageRequest) {
    return apiRequest<MessageResponse>(
      'POST',
      `/patient-needs/${encodeURIComponent(patientNeedId)}/messages`,
      { body: input },
    );
  },
};
