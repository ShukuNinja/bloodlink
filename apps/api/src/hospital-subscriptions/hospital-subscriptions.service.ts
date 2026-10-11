import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { HospitalSubscription } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(userId: string, hospitalId: string) {
    await this.requireActiveHospital(hospitalId);

    const existing = await this.prisma.hospitalSubscription.findFirst({
      where: { hospitalId, userId },
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
        data: { hospitalId, userId, status: 'ACTIVE' },
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
    const existing = await this.prisma.hospitalSubscription.findFirst({
      where: { hospitalId, userId },
    });
    if (!existing) throw new NotFoundException('Subscription not found');
    await this.prisma.hospitalSubscription.delete({
      where: { id: existing.id },
    });
  }

  async listSubscriptions(userId: string) {
    const rows = await this.prisma.hospitalSubscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toSubscription);
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
