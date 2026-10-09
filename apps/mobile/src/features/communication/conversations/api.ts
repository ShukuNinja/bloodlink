import type {
  ConversationResponse,
  CreateMessageRequest,
  MessageResponse,
} from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Mobile request-scoped communication API boundary. | ENDPOINT/METHOD: GET conversation and POST message. | INPUT: Request ID and shared message input. | OUTPUT: Shared envelopes. | AUTHORIZATION: API verifies workflow participant. | DEPENDENCIES: Shared contracts and existing API client. | STATE CHANGES: TODO(D4) message creation. | NON-RESPONSIBILITIES: Generic chat. | IMPLEMENTATION: TODO(D4). */
export type ConversationsApi = {
  get(requestId: string): Promise<ConversationResponse>;
  send(
    requestId: string,
    input: CreateMessageRequest,
  ): Promise<MessageResponse>;
};
