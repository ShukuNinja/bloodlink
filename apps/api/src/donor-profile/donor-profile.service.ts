import { Injectable, NotFoundException } from '@nestjs/common';
import type { DonorProfileUpdate } from '@bloodlink/contracts';
import type { DonorProfile } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../database/generated/prisma/client';

/**
 * OWNER: D4
 * PURPOSE: Donor-owned coordination profile boundary.
 * ENDPOINT/METHOD: GET/PATCH donor profile.
 * INPUT: Authenticated owner and shared profile update.
 * OUTPUT: Public representation that intentionally omits precise location;
 * canonical geography is written but never returned.
 * AUTHORIZATION: Authenticated User who owns the DonorProfile; every query
 * is keyed by the authenticated userId, so profiles are isolated per owner.
 * STATE CHANGES: Coordination preferences and canonical geography only.
 * Location writes use the existing PostGIS geography column via
 * ST_SetSRID/ST_MakePoint — no duplicate latitude/longitude storage.
 * NON-RESPONSIBILITIES: Medical eligibility, cooldown calculation, or donor
 * location disclosure.
 */
@Injectable()
export class DonorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string): Promise<DonorProfile> {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Donor profile not found');
    return toPublicDonorProfile(profile);
  }

  /**
   * Upserts the caller's own profile. Only the fields present in the shared
   * update contract are written; a location update writes the canonical
   * geography column and is never echoed back.
   */
  async updateOwnProfile(
    userId: string,
    input: DonorProfileUpdate,
  ): Promise<DonorProfile> {
    const existing = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });

    const dataFields = {
      ...(input.bloodGroup !== undefined
        ? { bloodGroup: input.bloodGroup }
        : {}),
      ...(input.availabilityStatus !== undefined
        ? { availabilityStatus: input.availabilityStatus }
        : {}),
      ...(input.notificationPreference !== undefined
        ? { notificationPreference: input.notificationPreference }
        : {}),
    };

    const profile = existing
      ? await this.prisma.donorProfile.update({
          where: { userId },
          data: dataFields,
        })
      : await this.prisma.donorProfile.create({
          data: {
            userId,
            coordinationStatus: 'ACTIVE',
            ...dataFields,
          } as Prisma.DonorProfileUncheckedCreateInput,
        });

    if (input.location) {
      const longitude = input.location.longitude;
      const latitude = input.location.latitude;
      const profileId = profile.id;
      await this.prisma.$executeRaw`UPDATE "DonorProfile"
            SET "location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                "updatedAt" = now()
          WHERE "id" = ${profileId}`;
    }

    return toPublicDonorProfile(profile);
  }

  /** Internal helper for other D4 services; not exposed through routes. */
  async findProfileRowByUserId(userId: string) {
    return this.prisma.donorProfile.findUnique({ where: { userId } });
  }
}

export function toPublicDonorProfile(row: {
  id: string;
  bloodGroup: string | null;
  availabilityStatus: string | null;
  notificationPreference: string | null;
  coordinationStatus: string;
  lastConfirmedDonationAt: Date | null;
  eligibleFrom: Date | null;
}): DonorProfile {
  return {
    id: row.id,
    // The shared contract requires these fields; rows created through the
    // API always set them before the profile is used by matching.
    bloodGroup: row.bloodGroup as DonorProfile['bloodGroup'],
    availabilityStatus:
      row.availabilityStatus as DonorProfile['availabilityStatus'],
    notificationPreference:
      row.notificationPreference as DonorProfile['notificationPreference'],
    coordinationStatus:
      row.coordinationStatus as DonorProfile['coordinationStatus'],
    ...(row.lastConfirmedDonationAt
      ? { lastConfirmedDonationAt: row.lastConfirmedDonationAt.toISOString() }
      : {}),
    ...(row.eligibleFrom
      ? { eligibleFrom: row.eligibleFrom.toISOString() }
      : {}),
  };
}
