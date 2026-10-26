import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DonorResponse, OrganizationResponse } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: Donor and blood-centre response state boundary.
 * ENDPOINT/METHOD: POST /blood-requests/:id/accept|withdraw (donor),
 * POST /blood-requests/:id/organization-response[/withdraw] (blood centre).
 * AUTHORIZATION: Donor profile owner for donor responses; ACTIVE membership
 * in an ACTIVE BLOOD_CENTRE organization for organization responses.
 * STATE TRANSITIONS: none/NOTIFIED/EXPIRED/WITHDRAWN -> ACCEPTED (explicit
 * confirmation via the accept/response action); ACCEPTED/NOTIFIED ->
 * WITHDRAWN. Already-accepted responses conflict; withdrawal requires an
 * existing withdrawable response. WITHDRAWN rows are reused, never
 * duplicated (unique per request per responder).
 * STATE CHANGES: D4 response records only. Acceptance never creates
 * DonationRecord rows and never mutates BloodRequest lifecycle or
 * ResponderAssignment state — D3 coordinates from these records and invokes
 * the D4 Donations boundary when hospital fulfillment is confirmed.
 * NON-RESPONSIBILITIES: Matching, notifications, medical eligibility.
 */
@Injectable()
export class ResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  async acceptDonor(userId: string, bloodRequestId: string) {
    await this.requireDirectIndividualResponseSchema();
    await this.requireOpenForResponses(bloodRequestId);

    const existing = await this.prisma.donorResponse.findFirst({
      where: { bloodRequestId, userId },
    });
    if (existing && existing.status === 'ACCEPTED') {
      throw new ConflictException('Response already accepted');
    }

    const now = new Date();
    if (existing) {
      const updated = await this.prisma.donorResponse.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED', respondedAt: now, confirmedAt: now },
      });
      return toDonorResponse(updated);
    }

    try {
      const created = await this.prisma.donorResponse.create({
        data: {
          bloodRequestId,
          userId,
          status: 'ACCEPTED',
          respondedAt: now,
          confirmedAt: now,
        },
      });
      return toDonorResponse(created);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Response already exists');
      }
      throw error;
    }
  }

  async withdrawDonor(userId: string, bloodRequestId: string) {
    await this.requireDirectIndividualResponseSchema();
    const existing = await this.prisma.donorResponse.findFirst({
      where: { bloodRequestId, userId },
    });
    if (!existing) throw new NotFoundException('Response not found');
    if (existing.status === 'WITHDRAWN') {
      throw new ConflictException('Response already withdrawn');
    }
    await this.requireOpenForResponses(bloodRequestId);
    const updated = await this.prisma.donorResponse.update({
      where: { id: existing.id },
      data: { status: 'WITHDRAWN' },
    });
    return toDonorResponse(updated);
  }

  async listDonorResponses(userId: string) {
    if (typeof this.prisma.$queryRaw !== 'function') {
      const rows = await this.prisma.donorResponse.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(toDonorResponse);
    }
    const [directUserLink] = await this.prisma.$queryRaw<
      Array<{ present: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'DonorResponse'
          AND column_name = 'userId'
      ) AS present
    `;
    const rows = directUserLink?.present
      ? await this.prisma.donorResponse.findMany({
          where: { userId },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        })
      : await this.prisma.$queryRaw<
          Array<{
            id: string;
            bloodRequestId: string;
            status: string;
            respondedAt: Date | null;
            confirmedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
          }>
        >`
          SELECT response.id, response."bloodRequestId", response.status,
            response."respondedAt", response."confirmedAt",
            response."createdAt", response."updatedAt"
          FROM "DonorResponse" response
          JOIN "DonorProfile" profile ON profile.id = response."donorId"
          WHERE profile."userId" = ${userId}::uuid
          ORDER BY response."updatedAt" DESC, response.id ASC
        `;
    return rows.map(toDonorResponse);
  }

  private async requireDirectIndividualResponseSchema() {
    if (typeof this.prisma.$queryRaw !== 'function') return;
    const [column] = await this.prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'DonorResponse'
          AND column_name = 'userId'
      ) AS present
    `;
    if (!column?.present) {
      throw new ServiceUnavailableException(
        'Individual responses are unavailable until the direct-Individual donor migration is applied.',
      );
    }
  }

  async listOrganizationResponses(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        role: { in: ['BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF'] },
        organization: { status: 'ACTIVE', type: 'BLOOD_CENTRE' },
      },
      select: { organizationId: true },
    });
    const organizationIds = memberships.map(
      (membership) => membership.organizationId,
    );
    if (organizationIds.length === 0) {
      throw new NotFoundException('Blood centre membership not found');
    }
    const rows = await this.prisma.organizationResponse.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toOrganizationResponse);
  }

  async createOrganizationResponse(userId: string, bloodRequestId: string) {
    const organizationId = await this.requireBloodCentreMembership(userId);
    await this.requireOpenForResponses(bloodRequestId);

    const existing = await this.prisma.organizationResponse.findFirst({
      where: { bloodRequestId, organizationId },
    });
    if (existing && existing.status === 'ACCEPTED') {
      throw new ConflictException('Response already accepted');
    }

    const now = new Date();
    if (existing) {
      const updated = await this.prisma.organizationResponse.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED', respondedAt: now, confirmedAt: now },
      });
      return toOrganizationResponse(updated);
    }

    try {
      const created = await this.prisma.organizationResponse.create({
        data: {
          bloodRequestId,
          organizationId,
          status: 'ACCEPTED',
          respondedAt: now,
          confirmedAt: now,
        },
      });
      return toOrganizationResponse(created);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Response already exists');
      }
      throw error;
    }
  }

  async withdrawOrganizationResponse(userId: string, bloodRequestId: string) {
    const organizationId = await this.requireBloodCentreMembership(userId);
    const existing = await this.prisma.organizationResponse.findFirst({
      where: { bloodRequestId, organizationId },
    });
    if (!existing) throw new NotFoundException('Response not found');
    if (existing.status === 'WITHDRAWN') {
      throw new ConflictException('Response already withdrawn');
    }
    await this.requireOpenForResponses(bloodRequestId);
    const updated = await this.prisma.organizationResponse.update({
      where: { id: existing.id },
      data: { status: 'WITHDRAWN' },
    });
    return toOrganizationResponse(updated);
  }

  /**
   * Responses attach only to requests that are still open to coordination;
   * once fulfillment starts or the request is cancelled, new responses are
   * conflicts. Read access is unrestricted here because request rows carry
   * no private data (hospital ID, blood group, urgency).
   */
  private async requireOpenForResponses(bloodRequestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: bloodRequestId },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('BloodRequest not found');
    const openForResponses = [
      'OPEN',
      'RESPONSES_RECEIVED',
      'COVERED',
      'COORDINATING',
      'BACKUP_REQUIRED',
    ];
    if (!openForResponses.includes(request.status)) {
      throw new ConflictException(
        'BloodRequest is no longer accepting responses',
      );
    }
    return request;
  }

  private async requireBloodCentreMembership(userId: string): Promise<string> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        role: { in: ['BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF'] },
        organization: { status: 'ACTIVE', type: 'BLOOD_CENTRE' },
      },
      select: { organizationId: true },
    });
    if (!membership) {
      throw new NotFoundException('Blood centre membership not found');
    }
    return membership.organizationId;
  }
}

export function toDonorResponse(row: {
  id: string;
  bloodRequestId: string;
  status: string;
  respondedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DonorResponse {
  return {
    id: row.id,
    bloodRequestId: row.bloodRequestId,
    status: row.status as DonorResponse['status'],
    ...(row.respondedAt ? { respondedAt: row.respondedAt.toISOString() } : {}),
    ...(row.confirmedAt ? { confirmedAt: row.confirmedAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOrganizationResponse(row: {
  id: string;
  bloodRequestId: string;
  organizationId: string;
  status: string;
  respondedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationResponse {
  return {
    id: row.id,
    bloodRequestId: row.bloodRequestId,
    organizationId: row.organizationId,
    status: row.status as OrganizationResponse['status'],
    ...(row.respondedAt ? { respondedAt: row.respondedAt.toISOString() } : {}),
    ...(row.confirmedAt ? { confirmedAt: row.confirmedAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
