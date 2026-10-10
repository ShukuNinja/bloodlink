import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignResponderRequest,
  ResponderAssignmentView,
} from '@bloodlink/contracts';
import { PrismaService } from '../../database/prisma.service';
import { toResponderAssignmentView } from '../blood-requests.repository';
import { findMemberHospitalIds } from '../d3-memberships';
import { PRE_FULFILLMENT_REQUEST_STATUSES } from '../d3.validation';

/**
 * OWNER: D3
 * PURPOSE: Persistence for D3-owned responder assignments.
 * ENDPOINT/METHOD: Select, standby, release operations.
 * INPUT: Authenticated user, BloodRequest ID, response ID/type.
 * OUTPUT: Shared ResponderAssignmentView.
 * AUTHORIZATION: Active membership in the BloodRequest hospital; the
 * referenced response must exist, belong to that request, and be ACCEPTED.
 * DEPENDENCIES: Central PrismaService, BloodRequest, ResponderAssignment,
 * deferred D4 response tables (read-only).
 * STATE CHANGES: ResponderAssignment rows only, plus the D3-owned
 * BloodRequest coverage status derived from selection/release. D4 response
 * rows are read but NEVER mutated here.
 * LEAD DECISION D3 assignment rules:
 * - at most one SELECTED responder per request; selecting demotes the
 *   previous SELECTED assignment to RELEASED;
 * - selecting an accepted response covers the request (status COVERED);
 * - releasing the selected responder reopens coverage (RESPONSES_RECEIVED
 *   while other accepted responses exist, otherwise OPEN) while the request
 *   is still COVERED;
 * - assignment actions are refused once fulfillment has started.
 * NON-RESPONSIBILITIES: Matching, response generation, notification, D4
 * lifecycle changes.
 */
@Injectable()
export class ResponderAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async select(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentView> {
    const request = await this.loadAuthorizedRequest(userId, bloodRequestId);
    if (
      !PRE_FULFILLMENT_REQUEST_STATUSES.includes(
        request.status as (typeof PRE_FULFILLMENT_REQUEST_STATUSES)[number],
      )
    ) {
      throw new ConflictException(
        'Responders cannot be selected once fulfillment has started',
      );
    }

    const response = await this.loadResponse(input, responseId);
    if (response.bloodRequestId !== bloodRequestId) {
      throw new BadRequestException('Response belongs to another BloodRequest');
    }
    if (response.status !== 'ACCEPTED') {
      throw new ConflictException('Only accepted responses can be selected');
    }

    const referenceField = referenceFieldFor(input.responseType);

    // Demote any previously selected responder; at most one SELECTED exists.
    await this.prisma.responderAssignment.updateMany({
      where: { bloodRequestId, state: 'SELECTED' },
      data: { state: 'RELEASED', releasedAt: new Date() },
    });

    const existing = await this.prisma.responderAssignment.findFirst({
      where: { bloodRequestId, [referenceField]: responseId },
    });
    const assignment = existing
      ? await this.prisma.responderAssignment.update({
          where: { id: existing.id },
          data: {
            state: 'SELECTED',
            assignedAt: new Date(),
            releasedAt: null,
          },
        })
      : await this.prisma.responderAssignment.create({
          data: {
            bloodRequestId,
            [referenceField]: responseId,
            state: 'SELECTED',
          },
        });

    if (request.status !== 'COVERED') {
      await this.prisma.bloodRequest.updateMany({
        where: {
          id: bloodRequestId,
          status: { in: [...PRE_FULFILLMENT_REQUEST_STATUSES] },
        },
        data: { status: 'COVERED' },
      });
    }

    return toResponderAssignmentView(assignment);
  }

  async standby(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentView> {
    const request = await this.loadAuthorizedRequest(userId, bloodRequestId);
    if (
      !PRE_FULFILLMENT_REQUEST_STATUSES.includes(
        request.status as (typeof PRE_FULFILLMENT_REQUEST_STATUSES)[number],
      )
    ) {
      throw new ConflictException(
        'Responders cannot be placed on standby once fulfillment has started',
      );
    }

    const response = await this.loadResponse(input, responseId);
    if (response.bloodRequestId !== bloodRequestId) {
      throw new BadRequestException('Response belongs to another BloodRequest');
    }
    if (response.status !== 'ACCEPTED') {
      throw new ConflictException(
        'Only accepted responses can be placed on standby',
      );
    }

    const referenceField = referenceFieldFor(input.responseType);
    const existing = await this.prisma.responderAssignment.findFirst({
      where: { bloodRequestId, [referenceField]: responseId },
    });
    const assignment = existing
      ? await this.prisma.responderAssignment.update({
          where: { id: existing.id },
          data: { state: 'STANDBY', releasedAt: null },
        })
      : await this.prisma.responderAssignment.create({
          data: {
            bloodRequestId,
            [referenceField]: responseId,
            state: 'STANDBY',
          },
        });

    return toResponderAssignmentView(assignment);
  }

  async release(
    userId: string,
    bloodRequestId: string,
    responseId: string,
    input: AssignResponderRequest,
  ): Promise<ResponderAssignmentView> {
    const request = await this.loadAuthorizedRequest(userId, bloodRequestId);
    const referenceField = referenceFieldFor(input.responseType);

    const existing = await this.prisma.responderAssignment.findFirst({
      where: { bloodRequestId, [referenceField]: responseId },
    });
    if (!existing) {
      throw new NotFoundException('Responder assignment not found');
    }
    if (existing.state === 'RELEASED') {
      throw new ConflictException('Responder already released');
    }

    const assignment = await this.prisma.responderAssignment.update({
      where: { id: existing.id },
      data: { state: 'RELEASED', releasedAt: new Date() },
    });

    // Reopen coverage only while the request is still COVERED; later
    // lifecycle states are managed by fulfillment, not assignment.
    if (existing.state === 'SELECTED' && request.status === 'COVERED') {
      const remainingAccepted =
        await this.countAcceptedResponses(bloodRequestId);
      await this.prisma.bloodRequest.updateMany({
        where: { id: bloodRequestId, status: 'COVERED' },
        data: {
          status: remainingAccepted > 0 ? 'RESPONSES_RECEIVED' : 'OPEN',
        },
      });
    }

    return toResponderAssignmentView(assignment);
  }

  private async loadAuthorizedRequest(userId: string, bloodRequestId: string) {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    const request = await this.prisma.bloodRequest.findFirst({
      where: { id: bloodRequestId, hospitalId: { in: hospitalIds } },
    });
    if (!request) throw new NotFoundException('BloodRequest not found');
    return request;
  }

  private async loadResponse(
    input: AssignResponderRequest,
    responseId: string,
  ): Promise<{ id: string; bloodRequestId: string; status: string }> {
    const response =
      input.responseType === 'DONOR_RESPONSE'
        ? await this.prisma.donorResponse.findFirst({
            where: { id: responseId },
            select: { id: true, bloodRequestId: true, status: true },
          })
        : await this.prisma.organizationResponse.findFirst({
            where: { id: responseId },
            select: { id: true, bloodRequestId: true, status: true },
          });
    if (!response) throw new NotFoundException('Response not found');
    return response;
  }

  private async countAcceptedResponses(
    bloodRequestId: string,
  ): Promise<number> {
    const [donorCount, organizationCount] = await Promise.all([
      this.prisma.donorResponse.count({
        where: { bloodRequestId, status: 'ACCEPTED' },
      }),
      this.prisma.organizationResponse.count({
        where: { bloodRequestId, status: 'ACCEPTED' },
      }),
    ]);
    return donorCount + organizationCount;
  }
}

function referenceFieldFor(
  responseType: AssignResponderRequest['responseType'],
): 'donorResponseId' | 'organizationResponseId' {
  return responseType === 'DONOR_RESPONSE'
    ? 'donorResponseId'
    : 'organizationResponseId';
}
