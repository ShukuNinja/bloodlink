import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BloodRequestDetail,
  BloodRequestListQuery,
  BloodRequestRecord,
  ResponderAssignmentView,
  ResponderResponseReference,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import { findMemberHospitalIds } from './d3-memberships';
import {
  normalizeD3Pagination,
  PRE_FULFILLMENT_REQUEST_STATUSES,
} from './d3.validation';
import { toBloodRequestRecord } from './hospital-patient-needs.repository';

/**
 * OWNER: D3
 * PURPOSE: Hospital-scoped BloodRequest persistence access.
 * ENDPOINT/METHOD: BloodRequest listing, detail, cancellation, response
 * references, and fulfillment actions.
 * INPUT: Authenticated user ID, BloodRequest ID, query.
 * OUTPUT: Shared BloodRequest contracts.
 * AUTHORIZATION: Every lookup verifies active membership in the request's
 * HOSPITAL organization; other hospitals' requests read as missing (404).
 * DEPENDENCIES: Central PrismaService, BloodRequest, and ResponderAssignment.
 * STATE CHANGES: Cancellation is allowed only while the request is still in
 * a pre-fulfillment state (LEAD DECISION D3 lifecycle): once fulfillment has
 * started the request is locked against cancellation. Fulfillment itself may
 * start only from a pre-fulfillment state with a selected responder, and
 * confirmation only from FULFILLMENT_PENDING. No backward transitions.
 * NON-RESPONSIBILITIES: Public creation, D4 response mutation, matching,
 * notifications, medical workflows.
 */
@Injectable()
export class BloodRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyForUser(userId: string, query: BloodRequestListQuery) {
    const { page, pageSize, skip } = normalizeD3Pagination(query);
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    if (hospitalIds.length === 0) {
      return {
        data: [] as BloodRequestRecord[],
        meta: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    const where = {
      hospitalId: { in: hospitalIds },
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map(toBloodRequestRecord),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOneForUser(
    userId: string,
    bloodRequestId: string,
  ): Promise<BloodRequestDetail> {
    const row = await this.findScopedRequest(userId, bloodRequestId);
    const assignments = await this.prisma.responderAssignment.findMany({
      where: { bloodRequestId: row.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      ...toBloodRequestRecord(row),
      assignments: assignments.map(toResponderAssignmentView),
    };
  }

  async cancelForUser(
    userId: string,
    bloodRequestId: string,
  ): Promise<BloodRequestRecord> {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    const result = await this.prisma.bloodRequest.updateMany({
      where: {
        id: bloodRequestId,
        hospitalId: { in: hospitalIds },
        status: { in: [...PRE_FULFILLMENT_REQUEST_STATUSES] },
      },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 1) {
      const row = await this.findScopedRequest(userId, bloodRequestId);
      return toBloodRequestRecord(row);
    }
    // Distinguish "not ours" (404) from "no longer cancellable" (409).
    await this.findScopedRequest(userId, bloodRequestId);
    throw new ConflictException('BloodRequest can no longer be cancelled');
  }

  /**
   * Read-only references to D4 response rows. D3 never mutates those rows;
   * it only lists them so hospital staff can choose responders.
   */
  async listResponseReferences(
    userId: string,
    bloodRequestId: string,
  ): Promise<ResponderResponseReference[]> {
    const row = await this.findScopedRequest(userId, bloodRequestId);
    const [donorResponses, organizationResponses] = await Promise.all([
      this.prisma.donorResponse.findMany({
        where: { bloodRequestId: row.id },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.organizationResponse.findMany({
        where: { bloodRequestId: row.id },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return [
      ...donorResponses.map((response): ResponderResponseReference => ({
        responseId: response.id,
        responseType: 'DONOR_RESPONSE',
      })),
      ...organizationResponses.map((response): ResponderResponseReference => ({
        responseId: response.id,
        responseType: 'ORGANIZATION_RESPONSE',
      })),
    ];
  }

  /**
   * LEAD DECISION D3 lifecycle: fulfillment starts only from a
   * pre-fulfillment state and only once a responder has been selected; the
   * request then moves to FULFILLMENT_PENDING.
   */
  async startFulfillment(
    userId: string,
    bloodRequestId: string,
  ): Promise<BloodRequestRecord> {
    const row = await this.findScopedRequest(userId, bloodRequestId);
    if (
      !PRE_FULFILLMENT_REQUEST_STATUSES.includes(
        row.status as (typeof PRE_FULFILLMENT_REQUEST_STATUSES)[number],
      )
    ) {
      throw new ConflictException('Fulfillment cannot start in this state');
    }
    const selected = await this.prisma.responderAssignment.findFirst({
      where: { bloodRequestId: row.id, state: 'SELECTED' },
      select: { id: true },
    });
    if (!selected) {
      throw new ConflictException('No responder has been selected');
    }

    const updated = await this.prisma.bloodRequest.updateMany({
      where: {
        id: row.id,
        status: { in: [...PRE_FULFILLMENT_REQUEST_STATUSES] },
      },
      data: { status: 'FULFILLMENT_PENDING' },
    });
    if (updated.count === 0) {
      throw new ConflictException('Fulfillment cannot start in this state');
    }
    return toBloodRequestRecord({ ...row, status: 'FULFILLMENT_PENDING' });
  }

  /**
   * Confirmation is allowed only from FULFILLMENT_PENDING; a confirmed or
   * fulfilled request never transitions backward.
   */
  async confirmFulfillment(
    userId: string,
    bloodRequestId: string,
  ): Promise<BloodRequestRecord> {
    const row = await this.findScopedRequest(userId, bloodRequestId);
    if (row.status !== 'FULFILLMENT_PENDING') {
      throw new ConflictException(
        'Fulfillment cannot be confirmed in this state',
      );
    }
    const updated = await this.prisma.bloodRequest.updateMany({
      where: { id: row.id, status: 'FULFILLMENT_PENDING' },
      data: { status: 'FULFILLMENT_CONFIRMED' },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'Fulfillment cannot be confirmed in this state',
      );
    }
    return toBloodRequestRecord({ ...row, status: 'FULFILLMENT_CONFIRMED' });
  }

  private async findScopedRequest(userId: string, bloodRequestId: string) {
    const hospitalIds = await findMemberHospitalIds(this.prisma, userId);
    const row = await this.prisma.bloodRequest.findFirst({
      where: { id: bloodRequestId, hospitalId: { in: hospitalIds } },
    });
    if (!row) throw new NotFoundException('BloodRequest not found');
    return row;
  }
}

export function toResponderAssignmentView(row: {
  id: string;
  bloodRequestId: string;
  donorResponseId: string | null;
  organizationResponseId: string | null;
  state: string;
  assignedAt: Date;
  releasedAt: Date | null;
}): ResponderAssignmentView {
  const response: ResponderAssignmentView['response'] = row.donorResponseId
    ? { responseId: row.donorResponseId, responseType: 'DONOR_RESPONSE' }
    : {
        responseId: row.organizationResponseId as string,
        responseType: 'ORGANIZATION_RESPONSE',
      };
  return {
    id: row.id,
    bloodRequestId: row.bloodRequestId,
    response,
    state: row.state as ResponderAssignmentView['state'],
    assignedAt: row.assignedAt.toISOString(),
    ...(row.releasedAt ? { releasedAt: row.releasedAt.toISOString() } : {}),
  };
}
