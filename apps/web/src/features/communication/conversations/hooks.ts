import type { ConversationsApi } from './api';
/** OWNER: D4 | PURPOSE: Request-scoped communication hook boundary. | ENDPOINT/METHOD: Conversation/message queries and send. | INPUT: Existing API client. | OUTPUT: TODO(D4) hook contract. | AUTHORIZATION: API enforced. | DEPENDENCIES: ConversationsApi. | STATE CHANGES: None in scaffold. | NON-RESPONSIBILITIES: Generic chat or WebSockets. | IMPLEMENTATION: TODO(D4). */
export type ConversationHooks = { api: ConversationsApi };
