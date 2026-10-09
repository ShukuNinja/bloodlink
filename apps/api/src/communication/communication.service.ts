import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CreateMessageRequest } from '@bloodlink/contracts';

/**
 * OWNER: D4
 * PURPOSE: Request-scoped hospital/responder communication boundary.
 * ENDPOINT/METHOD: GET conversation and POST message operations.
 * INPUT: Authenticated user, BloodRequest ID, and validated message content.
 * OUTPUT: TODO(D4); no fabricated conversation or message.
 * AUTHORIZATION: Verify hospital participation through BloodRequest.hospitalId,
 * or exactly one responder (donor XOR BLOOD_CENTRE organization) in that
 * BloodRequest workflow; reject all unrelated users server-side.
 * DEPENDENCIES: Conversation, Message, BloodRequest and response participation.
 * STATE CHANGES: Message creation only when implemented.
 * NON-RESPONSIBILITIES: Generic chat, donor-to-donor, donor-to-centre, or three-way conversation.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class CommunicationService {
  getConversation(_userId: string, _bloodRequestId: string): never {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): authorized conversation');
  }

  createMessage(
    _userId: string,
    _bloodRequestId: string,
    _input: CreateMessageRequest,
  ): never {
    void _userId;
    void _bloodRequestId;
    void _input;
    throw new NotImplementedException('TODO(D4): request-scoped message');
  }
}
