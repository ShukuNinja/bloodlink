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
import { DonorProfileService } from '../donor-profile/donor-profile.service';
import { toBloodRequestRecord } from '../blood-requests/hospital-patient-needs.repository';
import {
  EXPANDING_TIER_RADIUS_METERS,
  NEAREST_TIER_RADIUS_METERS,
  normalizeD4Pagination,
} from '../d4/d4.validation';

/**
 * OWNER: D4
 * PURPOSE: Matching boundary — donor-visible request discovery and
 * notification candidate selection.
 * AUTHORIZATION: Donor endpoints require the caller's own DonorProfile;
 * blood-centre endpoints require an ACTIVE membership in an ACTIVE
 * BLOOD_CENTRE organization.
 * SPATIAL DESIGN: Radius filtering and distance ranking run on the existing
 * PostGIS geography columns via ST_DWithin/ST_Distance (donor point ->
 * hospital location). Donor coordinates are written once to the canonical
 * geography column and never returned in any response.
 * STATE CHANGES: None (read-only boundary).
 * NON-RESPONSIBILITIES: Medical eligibility, response mutation, D3
 * lifecycle. Blood group, availability, coordination-status, and
 * notification-preference filters are applied as ordinary predicates.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: DonorProfileService,
  ) {}

  async listDonorRequests(userId: string, query: DonorBloodRequestQuery) {
    const profile = await this.requireProfile(userId);
    const { page, pageSize, skip } = normalizeD4Pagination(query);
    const status = query.status ?? 'OPEN';

    if (!profile.bloodGroup) {
      return {
        data: [] as DonorBloodRequestSummary[],
        meta: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    // Donors without a canonical location still see blood-group-matched
    // requests (without distance); radius filtering applies once the
    // profile carries a location.
    const donorPoint = await this.profileLocation(profile.id);

    const baseWhere = Prisma.sql`br."status" = ${status}
        AND br."bloodGroup" = ${profile.bloodGroup}::"PatientNeedBloodGroup"`;
    const spatial = donorPoint
      ? Prisma.sql`
        AND org."location" IS NOT NULL
        AND ST_DWithin(org."location", ST_SetSRID(ST_MakePoint(${donorPoint.longitude}, ${donorPoint.latitude}), 4326)::geography, ${NEAREST_TIER_RADIUS_METERS}::double precision)`
      : Prisma.empty;
    const distanceSelect = donorPoint
      ? Prisma.sql`ST_Distance(org."location", ST_SetSRID(ST_MakePoint(${donorPoint.longitude}, ${donorPoint.latitude}), 4326)::geography) AS "distanceMeters"`
      : Prisma.sql`NULL AS "distanceMeters"`;

    const countRows = await this.prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`SELECT COUNT(*)::int AS total
        FROM "BloodRequest" br
        JOIN "Organization" org ON org."id" = br."hospitalId"
        WHERE ${baseWhere} ${spatial}`,
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
               org."name" AS "hospitalName", ${distanceSelect}
        FROM "BloodRequest" br
        JOIN "Organization" org ON org."id" = br."hospitalId"
        WHERE ${baseWhere} ${spatial}
        ORDER BY "distanceMeters" ASC NULLS LAST, br."requiredBy" ASC, br."id" ASC
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
    const profile = await this.requireProfile(userId);
    const row = await this.prisma.bloodRequest.findFirst({
      where: {
        id: bloodRequestId,
        ...(profile.bloodGroup
          ? { bloodGroup: profile.bloodGroup }
          : { id: '00000000-0000-4000-8000-000000000000' }),
      },
      include: { hospital: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('BloodRequest not found');

    const donorPoint = await this.profileLocation(profile.id);
    let distanceMeters: number | null = null;
    if (donorPoint) {
      const within = await this.prisma.$queryRaw<
        Array<{ distanceMeters: number | null }>
      >(
        Prisma.sql`SELECT CASE WHEN org."location" IS NOT NULL
              THEN ST_Distance(org."location", ST_SetSRID(ST_MakePoint(${donorPoint.longitude}, ${donorPoint.latitude}), 4326)::geography)
              ELSE NULL END AS "distanceMeters"
          FROM "BloodRequest" br
          JOIN "Organization" org ON org."id" = br."hospitalId"
          WHERE br."id" = ${bloodRequestId}`,
      );
      distanceMeters = within[0]?.distanceMeters ?? null;
      if (
        distanceMeters !== null &&
        distanceMeters > NEAREST_TIER_RADIUS_METERS
      ) {
        throw new NotFoundException('BloodRequest not found');
      }
    }

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

    const donors = await this.prisma.donorProfile.findMany({
      where: {
        bloodGroup: request.bloodGroup,
        availabilityStatus: 'AVAILABLE',
        coordinationStatus: 'ACTIVE',
      },
    });
    const urgencyAllows = (preference: string | null): boolean => {
      if (preference === 'ALL') return true;
      if (preference === 'URGENT_ONLY')
        return request.urgency === 'URGENT' || request.urgency === 'CRITICAL';
      if (preference === 'CRITICAL_ONLY') return request.urgency === 'CRITICAL';
      return false;
    };
    const eligible = donors.filter((donor) =>
      urgencyAllows(donor.notificationPreference),
    );

    let candidateIds: Set<string>;
    if (tier === 'HOSPITAL_SUBSCRIBERS') {
      const subscriptions = await this.prisma.hospitalSubscription.findMany({
        where: { hospitalId: request.hospitalId, status: 'ACTIVE' },
        select: { donorId: true },
      });
      const subscribed = new Set(subscriptions.map((s) => s.donorId));
      candidateIds = new Set(
        eligible.filter((donor) => subscribed.has(donor.id)).map((d) => d.id),
      );
    } else {
      const radiusMeters =
        tier === 'EXPANDING_RADIUS'
          ? EXPANDING_TIER_RADIUS_METERS
          : NEAREST_TIER_RADIUS_METERS;
      const withinRows = await this.prisma.$queryRaw<
        Array<{ donorId: string }>
      >(
        Prisma.sql`SELECT dp."id" AS "donorId"
          FROM "DonorProfile" dp
          JOIN "Organization" org ON org."id" = ${request.hospitalId}
          WHERE dp."location" IS NOT NULL
            AND org."location" IS NOT NULL
            AND dp."bloodGroup" = ${request.bloodGroup}::"PatientNeedBloodGroup"
            AND ST_DWithin(dp."location", org."location", ${radiusMeters}::double precision)`,
      );
      const within = new Set(withinRows.map((row) => row.donorId));
      candidateIds = new Set(
        eligible.filter((donor) => within.has(donor.id)).map((d) => d.id),
      );
    }

    return {
      bloodRequestId: request.id,
      tier,
      candidates: [...candidateIds].map((donorId) => ({
        donorId,
        // Distance is derived server-side from canonical geography when a
        // notification is composed; the boundary only exposes an approximate
        // figure to keep precise donor coordinates internal.
        approximateDistanceKm: 0,
      })),
    };
  }

  private async requireProfile(userId: string) {
    const profile = await this.profiles.findProfileRowByUserId(userId);
    if (!profile) throw new NotFoundException('Donor profile not found');
    return profile;
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

  /** Reads the canonical geography back as lon/lat for bind parameters. */
  private async profileLocation(
    profileId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ latitude: number | null; longitude: number | null }>
    >(
      Prisma.sql`SELECT CASE WHEN "location" IS NOT NULL THEN ST_Y("location"::geometry) ELSE NULL END AS latitude,
               CASE WHEN "location" IS NOT NULL THEN ST_X("location"::geometry) ELSE NULL END AS longitude
        FROM "DonorProfile" WHERE "id" = ${profileId}`,
    );
    const row = rows[0];
    if (!row || row.latitude === null || row.longitude === null) return null;
    return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
  }
}
