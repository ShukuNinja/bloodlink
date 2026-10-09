import type {
  ConversationResponse,
  CreateMessageRequest,
  MessageResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Request-scoped conversation API boundary. | ENDPOINT/METHOD: GET conversation; POST message. | INPUT: BloodRequest ID and shared message input. | OUTPUT: Shared conversation/message envelopes. | AUTHORIZATION: API verifies request participant. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4) message creation only. | NON-RESPONSIBILITIES: Generic chat. | IMPLEMENTATION: TODO(D4). */
export type ConversationsApi = {
  get(requestId: string): Promise<ConversationResponse>;
  send(
    requestId: string,
    input: CreateMessageRequest,
  ): Promise<MessageResponse>;
};
