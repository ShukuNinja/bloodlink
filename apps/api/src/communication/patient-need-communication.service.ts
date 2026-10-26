import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateMessageRequest,
  PatientNeedConversationDetail,
  PatientNeedConversationSummary,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

const TERMINAL_REQUEST_STATUSES = [
  'FULFILLMENT_CONFIRMED',
  'FULFILLED',
  'CANCELLED',
];

@Injectable()
export class PatientNeedCommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<PatientNeedConversationSummary[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { type: 'HOSPITAL', status: 'ACTIVE' },
      },
      select: { organizationId: true },
    });
    const hospitalIds = memberships.map((item) => item.organizationId);
    const rows = await this.prisma.patientNeedConversation.findMany({
      where: {
        patientNeed: {
          OR: [
            { submittedByUserId: userId },
            ...(hospitalIds.length
              ? [{ hospitalId: { in: hospitalIds } }]
              : []),
          ],
        },
      },
      include: {
        patientNeed: { include: { hospital: { select: { name: true } } } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      patientNeedId: row.patientNeedId,
      hospitalName: row.patientNeed.hospital.name,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(row.messages[0]
        ? {
            lastMessage: {
              content: row.messages[0].content,
              createdAt: row.messages[0].createdAt.toISOString(),
              senderId: row.messages[0].senderId,
            },
          }
        : {}),
    }));
  }

  async getForPatientNeed(
    userId: string,
    patientNeedId: string,
  ): Promise<PatientNeedConversationDetail> {
    const need = await this.prisma.patientNeed.findUnique({
      where: { id: patientNeedId },
      include: {
        hospital: {
          select: { id: true, name: true, type: true, status: true },
        },
        bloodRequest: { select: { status: true } },
      },
    });
    if (!need) throw new NotFoundException('Patient need not found');
    const isSubmitter = need.submittedByUserId === userId;
    const isHospitalMember = await this.prisma.organizationMembership.findFirst(
      {
        where: {
          userId,
          organizationId: need.hospitalId,
          status: 'ACTIVE',
          role: { in: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
          organization: { type: 'HOSPITAL', status: 'ACTIVE' },
        },
        select: { id: true },
      },
    );
    if (!isSubmitter && !isHospitalMember) {
      throw new NotFoundException('Conversation not found');
    }
    if (need.status !== 'VERIFIED' || !need.bloodRequest) {
      throw new ConflictException(
        'This conversation becomes available after the hospital verifies the patient need and creates a blood request.',
      );
    }

    let conversation = await this.prisma.patientNeedConversation.upsert({
      where: { patientNeedId },
      create: {
        patientNeedId,
        status: TERMINAL_REQUEST_STATUSES.includes(need.bloodRequest.status)
          ? 'CLOSED'
          : 'OPEN',
      },
      update: {},
    });
    if (
      TERMINAL_REQUEST_STATUSES.includes(need.bloodRequest.status) &&
      conversation.status !== 'CLOSED'
    ) {
      conversation = await this.prisma.patientNeedConversation.update({
        where: { id: conversation.id },
        data: { status: 'CLOSED' },
      });
    }

    const messages = await this.prisma.patientNeedConversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      id: conversation.id,
      patientNeedId,
      hospitalName: need.hospital.name,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map((message) => ({
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
    patientNeedId: string,
    input: CreateMessageRequest,
  ) {
    const conversation = await this.getForPatientNeed(userId, patientNeedId);
    if (conversation.status === 'CLOSED') {
      throw new ConflictException('This request conversation is closed');
    }
    const message = await this.prisma.patientNeedConversationMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content: input.content,
      },
    });
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
