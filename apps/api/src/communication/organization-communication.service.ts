import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreateMessageRequest,
  OrganizationConversationDetail,
  OrganizationConversationSummary,
  OrganizationSummary,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrganizationCommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
  ): Promise<OrganizationConversationSummary[]> {
    const organizationIds = await this.activeOrganizationIds(userId);
    if (!organizationIds.length) return [];
    const conversations = await this.prisma.organizationConversation.findMany({
      where: {
        OR: [
          { participantAOrganizationId: { in: organizationIds } },
          { participantBOrganizationId: { in: organizationIds } },
        ],
      },
      include: {
        participantA: { select: { id: true, name: true, type: true } },
        participantB: { select: { id: true, name: true, type: true } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return conversations.map((row) => {
      const other = organizationIds.includes(row.participantAOrganizationId)
        ? row.participantB
        : row.participantA;
      const lastMessage = row.messages[0];
      return {
        id: row.id,
        otherOrganization: toSummary(other),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...(lastMessage
          ? {
              lastMessage: {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt.toISOString(),
                senderId: lastMessage.senderId,
              },
            }
          : {}),
      };
    });
  }

  async openForOrganizations(
    userId: string,
    targetOrganizationId: string,
    sourceOrganizationId: string,
  ): Promise<OrganizationConversationDetail> {
    const [source, target] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: sourceOrganizationId },
        select: { id: true, name: true, type: true, status: true },
      }),
      this.prisma.organization.findUnique({
        where: { id: targetOrganizationId },
        select: { id: true, name: true, type: true, status: true },
      }),
    ]);
    if (
      !source ||
      !target ||
      source.status !== 'ACTIVE' ||
      target.status !== 'ACTIVE'
    ) {
      throw new NotFoundException('Organization not found');
    }
    const authorized = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: source.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!authorized) throw new ForbiddenException('Active membership required');
    if (source.id === target.id || source.type === target.type) {
      throw new UnprocessableEntityException(
        'Conversations are available between a hospital and a blood centre.',
      );
    }

    const [participantAOrganizationId, participantBOrganizationId] = [
      source.id,
      target.id,
    ].sort();
    const conversation = await this.prisma.organizationConversation.upsert({
      where: {
        participantAOrganizationId_participantBOrganizationId: {
          participantAOrganizationId,
          participantBOrganizationId,
        },
      },
      create: {
        participantAOrganizationId,
        participantBOrganizationId,
        status: 'OPEN',
      },
      update: {},
    });
    return this.getForUser(userId, conversation.id);
  }

  async getForUser(
    userId: string,
    conversationId: string,
  ): Promise<OrganizationConversationDetail> {
    const row = await this.prisma.organizationConversation.findUnique({
      where: { id: conversationId },
      include: {
        participantA: { select: { id: true, name: true, type: true } },
        participantB: { select: { id: true, name: true, type: true } },
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!row) throw new NotFoundException('Conversation not found');
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        organizationId: {
          in: [row.participantAOrganizationId, row.participantBOrganizationId],
        },
      },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Conversation not found');
    return {
      id: row.id,
      participantA: toSummary(row.participantA),
      participantB: toSummary(row.participantB),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        ...(message.readAt ? { readAt: message.readAt.toISOString() } : {}),
      })),
    };
  }

  async createMessage(
    userId: string,
    conversationId: string,
    input: CreateMessageRequest,
  ) {
    const detail = await this.getForUser(userId, conversationId);
    if (detail.status === 'CLOSED') {
      throw new ConflictException('Conversation is closed');
    }
    const message = await this.prisma.organizationConversationMessage.create({
      data: { conversationId, senderId: userId, content: input.content },
    });
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async activeOrganizationIds(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        organization: {
          status: 'ACTIVE',
          type: { in: ['HOSPITAL', 'BLOOD_CENTRE'] },
        },
      },
      select: { organizationId: true },
    });
    return memberships.map((membership) => membership.organizationId);
  }
}

function toSummary(row: {
  id: string;
  name: string;
  type: string;
}): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type as OrganizationSummary['type'],
  };
}
