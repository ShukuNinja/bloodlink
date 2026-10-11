import type {
  ConversationResponse,
  CreateMessageRequest,
  MessageResponse,
} from '@bloodlink/contracts';
import { apiRequest } from '@/api/client';

export const communicationApi = {
  getConversation(requestId: string) {
    return apiRequest<ConversationResponse>(
      'GET',
      `/blood-requests/${encodeURIComponent(requestId)}/conversation`,
    );
  },
  sendMessage(requestId: string, input: CreateMessageRequest) {
    return apiRequest<MessageResponse>(
      'POST',
      `/blood-requests/${encodeURIComponent(requestId)}/messages`,
      { body: input },
    );
  },
};
