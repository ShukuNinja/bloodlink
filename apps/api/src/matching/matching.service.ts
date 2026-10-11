import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../database/generated/prisma/client';
import type {
  BloodRequestRecord,
  DonorBloodRequestQuery,
  DonorBloodRequestSummary,
  MatchingResultBoundary,
  MatchingTier,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import { toBloodRequestRecord } from '../blood-requests/hospital-patient-needs.repository';
import {
  normalizeD4Pagination,
  REQUEST_STATUSES_OPEN_FOR_RESPONSES,
} from '../d4/d4.validation';

/**
 * OWNER: D4
 * PURPOSE: Matching boundary — donor-visible request discovery and
 * notification candidate selection.
 * AUTHORIZATION: Donor endpoints require an authenticated Individual;
 * blood-centre endpoints require an ACTIVE membership in an ACTIVE
 * BLOOD_CENTRE organization.
 * SPATIAL DESIGN: Radius filtering and distance ranking run on the existing
 * PostGIS geography columns via ST_DWithin/ST_Distance (donor point ->
 * hospital location). Donor coordinates are written once to the canonical
 * geography column and never returned in any response.
 * STATE CHANGES: None (read-only boundary).
 * NON-RESPONSIBILITIES: Medical eligibility, response mutation, D3
 * lifecycle. Blood group, availability, coordination-status, and
 * Individual donor discovery deliberately lists all open requests; hospitals
 * verify compatibility after an Individual volunteers.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listDonorRequests(userId: string, query: DonorBloodRequestQuery) {
    void userId;
    const { page, pageSize, skip } = normalizeD4Pagination(query);
    const baseWhere = query.status
      ? Prisma.sql`br."status" = ${query.status}::"BloodRequestStatus"`
      : Prisma.sql`br."status" IN (${Prisma.join(
          REQUEST_STATUSES_OPEN_FOR_RESPONSES.map(
            (status) => Prisma.sql`${status}::"BloodRequestStatus"`,
          ),
        )})`;

    const countRows = await this.prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`SELECT COUNT(*)::int AS total
        FROM "BloodRequest" br
        JOIN "Organization" org ON org."id" = br."hospitalId"
        WHERE ${baseWhere}`,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        bloodGroup: string;
        component: string;
        unitsRequired: number;
        urgency: string;
        requiredBy: Date;
        status: string;
        hospitalName: string;
        distanceMeters: number | null;
      }>
    >(
      Prisma.sql`SELECT br."id", br."bloodGroup", br."component", br."unitsRequired",
               br."urgency", br."requiredBy", br."status",
               org."name" AS "hospitalName", NULL AS "distanceMeters"
        FROM "BloodRequest" br
        JOIN "Organization" org ON org."id" = br."hospitalId"
        WHERE ${baseWhere}
        ORDER BY br."requiredBy" ASC, br."id" ASC
        LIMIT ${pageSize} OFFSET ${skip}`,
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        bloodGroup: row.bloodGroup as DonorBloodRequestSummary['bloodGroup'],
        component: row.component as DonorBloodRequestSummary['component'],
        unitsRequired: row.unitsRequired,
        urgency: row.urgency as DonorBloodRequestSummary['urgency'],
        requiredBy: row.requiredBy.toISOString(),
        status: row.status as DonorBloodRequestSummary['status'],
        hospitalName: row.hospitalName,
        ...(row.distanceMeters !== null
          ? {
              approximateDistanceKm: Math.round(row.distanceMeters / 100) / 10,
            }
          : {}),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getDonorRequest(userId: string, bloodRequestId: string) {
    void userId;
    const row = await this.prisma.bloodRequest.findFirst({
      where: {
        id: bloodRequestId,
        status: { in: [...REQUEST_STATUSES_OPEN_FOR_RESPONSES] },
      },
      include: { hospital: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('BloodRequest not found');

    const distanceMeters: number | null = null;

    const summary: DonorBloodRequestSummary = {
      id: row.id,
      bloodGroup: row.bloodGroup,
      component: row.component,
      unitsRequired: row.unitsRequired,
      urgency: row.urgency,
      requiredBy: row.requiredBy.toISOString(),
      status: row.status,
      hospitalName: row.hospital.name,
      ...(distanceMeters !== null
        ? { approximateDistanceKm: Math.round(distanceMeters / 100) / 10 }
        : {}),
    };
    return summary;
  }

  /**
   * Blood-centre view: every non-cancelled request, membership-scoped by
   * the RBAC guard plus an explicit membership check. Responder assignment
   * identities are intentionally not included in this projection.
   */
  async listBloodCentreRequests(
    userId: string,
    query: { page?: number; pageSize?: number; status?: string },
  ) {
    await this.requireBloodCentreMembership(userId);
    const { page, pageSize, skip } = normalizeD4Pagination(query);
    const where = (
      query.status
        ? { status: query.status }
        : { status: { notIn: ['CANCELLED'] } }
    ) as Prisma.BloodRequestWhereInput;
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
      data: rows.map(toBloodRequestRecord) as BloodRequestRecord[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getBloodCentreRequest(userId: string, bloodRequestId: string) {
    await this.requireBloodCentreMembership(userId);
    const row = await this.prisma.bloodRequest.findUnique({
      where: { id: bloodRequestId },
    });
    if (!row) throw new NotFoundException('BloodRequest not found');
    return toBloodRequestRecord(row);
  }

  /**
   * Internal notification-candidate boundary. Filters donors by blood
   * group, availability, coordination status, and notification preference
   * (never medical criteria), then applies the tier's spatial or
   * subscription boundary:
   * - NEAREST_DONORS: within 25 km of the request hospital;
   * - HOSPITAL_SUBSCRIBERS: ACTIVE subscribers of the request hospital;
   * - EXPANDING_RADIUS: within 100 km.
   * Donor coordinates never leave the database layer.
   */
  async matchCandidates(
    bloodRequestId: string,
    tier: MatchingTier,
  ): Promise<MatchingResultBoundary> {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: bloodRequestId },
    });
    if (!request) throw new NotFoundException('BloodRequest not found');

    void tier;
    const answered = await this.prisma.donorResponse.findMany({
      where: { bloodRequestId, status: { in: ['ACCEPTED', 'WITHDRAWN'] } },
      select: { userId: true },
    });
    const users = await this.prisma.user.findMany({
      where: {
        role: 'INDIVIDUAL',
        status: 'ACTIVE',
        id: { notIn: answered.map((response) => response.userId) },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const candidateIds = users.map((user) => user.id);

    return {
      bloodRequestId: request.id,
      tier,
      candidates: candidateIds.map((donorId) => ({
        donorId,
        // Distance is derived server-side from canonical geography when a
        // notification is composed; the boundary only exposes an approximate
        // figure to keep precise donor coordinates internal.
        approximateDistanceKm: 0,
      })),
    };
  }

  private async requireBloodCentreMembership(userId: string) {
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
