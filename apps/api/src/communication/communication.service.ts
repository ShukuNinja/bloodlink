import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConversationDetail,
  CreateMessageRequest,
  Message,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: Request-scoped hospital/responder communication.
 * ENDPOINT/METHOD: GET /blood-requests/:id/conversation,
 * POST /blood-requests/:id/messages.
 * AUTHORIZATION: Only the request's hospital members (ACTIVE membership)
 * or the request's single SELECTED responder (the donor behind a selected
 * donor response, or members of a selected organization response). All
 * other users see the request as missing (404); this keeps conversation
 * existence itself private.
 * STATE CHANGES: Conversation rows are opened lazily for authorized
 * participants; messages append only. Closed conversations reject new
 * messages.
 * NON-RESPONSIBILITIES: Generic chat, patient-identifying payloads, push
 * delivery.
 */
@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getConversation(
    userId: string,
    bloodRequestId: string,
  ): Promise<ConversationDetail> {
    const participant = await this.resolveParticipant(userId, bloodRequestId);
    const conversation = await this.ensureConversation(
      bloodRequestId,
      participant,
    );
    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      id: conversation.id,
      bloodRequestId: conversation.bloodRequestId,
      status: conversation.status as ConversationDetail['status'],
      createdAt: conversation.createdAt.toISOString(),
      messages: messages.map(toMessage),
    };
  }

  async createMessage(
    userId: string,
    bloodRequestId: string,
    input: CreateMessageRequest,
  ): Promise<Message> {
    const participant = await this.resolveParticipant(userId, bloodRequestId);
    const conversation = await this.ensureConversation(
      bloodRequestId,
      participant,
    );
    if (conversation.status === 'CLOSED') {
      throw new ConflictException('Conversation is closed');
    }
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content: input.content,
      },
    });
    return toMessage(message);
  }

  /**
   * Resolves the caller's participation for this request:
   * - hospital member -> { kind: 'hospital' }
   * - selected donor responder -> { kind: 'donor', donorId }
   * - member of the selected responder organization -> { kind: 'organization', organizationId }
   * Anything else throws 404.
   */
  private async resolveParticipant(
    userId: string,
    bloodRequestId: string,
  ): Promise<
    | { kind: 'hospital' }
    | { kind: 'donor'; donorUserId: string }
    | { kind: 'organization'; organizationId: string }
  > {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: bloodRequestId },
      select: { id: true, hospitalId: true },
    });
    if (!request) throw new NotFoundException('Conversation not found');

    // A conversation only exists once D3 has selected exactly one
    // responder; before that, even hospital members get 404.
    const selected = await this.prisma.responderAssignment.findFirst({
      where: { bloodRequestId, state: 'SELECTED' },
      select: { donorResponseId: true, organizationResponseId: true },
    });
    if (!selected) throw new NotFoundException('Conversation not found');

    const selectedResponse = selected.donorResponseId
      ? await this.prisma.donorResponse.findUnique({
          where: { id: selected.donorResponseId },
          select: { status: true },
        })
      : selected.organizationResponseId
        ? await this.prisma.organizationResponse.findUnique({
            where: { id: selected.organizationResponseId },
            select: { status: true },
          })
        : null;
    if (selectedResponse?.status !== 'ACCEPTED') {
      throw new NotFoundException('Conversation not found');
    }

    const hospitalMembership =
      await this.prisma.organizationMembership.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          organizationId: request.hospitalId,
          role: { in: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
          organization: { status: 'ACTIVE', type: 'HOSPITAL' },
        },
        select: { id: true },
      });
    if (hospitalMembership) return { kind: 'hospital' };

    if (selected.donorResponseId) {
      const donorResponse = await this.prisma.donorResponse.findUnique({
        where: { id: selected.donorResponseId },
        select: { userId: true, status: true },
      });
      if (
        donorResponse?.status === 'ACCEPTED' &&
        donorResponse.userId === userId
      ) {
        return { kind: 'donor', donorUserId: userId };
      }
      throw new NotFoundException('Conversation not found');
    }

    if (selected.organizationResponseId) {
      const organizationResponse =
        await this.prisma.organizationResponse.findUnique({
          where: { id: selected.organizationResponseId },
          select: { organizationId: true, status: true },
        });
      if (organizationResponse?.status === 'ACCEPTED') {
        const membership = await this.prisma.organizationMembership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            organizationId: organizationResponse.organizationId,
            role: { in: ['BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF'] },
            organization: { status: 'ACTIVE', type: 'BLOOD_CENTRE' },
          },
          select: { id: true },
        });
        if (membership) {
          return {
            kind: 'organization',
            organizationId: organizationResponse.organizationId,
          };
        }
      }
    }
    throw new NotFoundException('Conversation not found');
  }

  private async ensureConversation(
    bloodRequestId: string,
    participant:
      | { kind: 'hospital' }
      | { kind: 'donor'; donorUserId: string }
      | { kind: 'organization'; organizationId: string },
  ) {
    // One shared thread per request: hospital and the selected responder
    // always converge on the same conversation row.
    const existing = await this.prisma.conversation.findFirst({
      where: { bloodRequestId },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        bloodRequestId,
        status: 'OPEN',
        ...(participant.kind === 'donor'
          ? { donorUserId: participant.donorUserId }
          : {}),
        ...(participant.kind === 'organization'
          ? { organizationId: participant.organizationId }
          : {}),
      },
    });
  }
}

function toMessage(row: {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
}): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    ...(row.readAt ? { readAt: row.readAt.toISOString() } : {}),
  };
}
