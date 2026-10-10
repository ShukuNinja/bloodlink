import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { HospitalSubscription } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import { DonorProfileService } from '../donor-profile/donor-profile.service';

/**
 * OWNER: D4
 * PURPOSE: Donor-to-hospital network subscriptions.
 * ENDPOINT/METHOD: POST/DELETE /hospitals/:id/subscription,
 * GET /hospital-subscriptions.
 * AUTHORIZATION: Donor owner only; every query is scoped to the caller's
 * DonorProfile. Targets must be existing ACTIVE HOSPITAL organizations.
 * STATE CHANGES: HospitalSubscription rows (ACTIVE/PAUSED). Subscribing is
 * idempotent across PAUSED rows; duplicates are rejected. Unsubscribing
 * removes the row.
 * NON-RESPONSIBILITIES: Device push subscriptions, matching, notifications.
 */
@Injectable()
export class HospitalSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: DonorProfileService,
  ) {}

  async subscribe(userId: string, hospitalId: string) {
    const profile = await this.requireProfile(userId);
    await this.requireActiveHospital(hospitalId);

    const existing = await this.prisma.hospitalSubscription.findFirst({
      where: { hospitalId, donorId: profile.id },
    });
    if (existing && existing.status === 'ACTIVE') {
      throw new ConflictException('Subscription already exists');
    }
    if (existing) {
      const reactivated = await this.prisma.hospitalSubscription.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      });
      return toSubscription(reactivated);
    }

    try {
      const created = await this.prisma.hospitalSubscription.create({
        data: { hospitalId, donorId: profile.id, status: 'ACTIVE' },
      });
      return toSubscription(created);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Subscription already exists');
      }
      throw error;
    }
  }

  /** DELETE semantics: removing a missing subscription is a 404. */
  async unsubscribe(userId: string, hospitalId: string): Promise<void> {
    const profile = await this.requireProfile(userId);
    const existing = await this.prisma.hospitalSubscription.findFirst({
      where: { hospitalId, donorId: profile.id },
    });
    if (!existing) throw new NotFoundException('Subscription not found');
    await this.prisma.hospitalSubscription.delete({
      where: { id: existing.id },
    });
  }

  async listSubscriptions(userId: string) {
    const profile = await this.requireProfile(userId);
    const rows = await this.prisma.hospitalSubscription.findMany({
      where: { donorId: profile.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toSubscription);
  }

  private async requireProfile(userId: string) {
    const profile = await this.profiles.findProfileRowByUserId(userId);
    if (!profile) throw new NotFoundException('Donor profile not found');
    return profile;
  }

  private async requireActiveHospital(hospitalId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: hospitalId },
      select: { id: true, type: true, status: true },
    });
    if (
      !organization ||
      organization.type !== 'HOSPITAL' ||
      organization.status !== 'ACTIVE'
    ) {
      throw new UnprocessableEntityException('Hospital is not eligible');
    }
    return organization;
  }
}

function toSubscription(row: {
  id: string;
  hospitalId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): HospitalSubscription {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    status: row.status as HospitalSubscription['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
