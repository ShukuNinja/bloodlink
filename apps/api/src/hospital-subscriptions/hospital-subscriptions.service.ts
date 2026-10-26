import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrganizationSubscription } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: User-to-organization subscriptions for hospitals and blood centres.
 * ENDPOINT/METHOD: POST/DELETE /organizations/:id/subscription,
 * GET /organization-subscriptions.
 * AUTHORIZATION: Authenticated user owner. Targets must be existing ACTIVE
 * HOSPITAL or BLOOD_CENTRE organizations; individual users cannot be targets.
 * STATE CHANGES: OrganizationSubscription rows (ACTIVE/PAUSED). Subscribing is
 * idempotent across PAUSED rows; duplicates are rejected. Unsubscribing
 * removes the row.
 * NON-RESPONSIBILITIES: Device push subscriptions, matching, notifications.
 */
@Injectable()
export class HospitalSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(userId: string, organizationId: string) {
    await this.requireActiveOrganization(organizationId);

    const existing = await this.prisma.organizationSubscription.findFirst({
      where: { organizationId, userId },
      include: { organization: { select: { name: true, type: true } } },
    });
    if (existing && existing.status === 'ACTIVE') {
      throw new ConflictException('Subscription already exists');
    }
    if (existing) {
      const reactivated = await this.prisma.organizationSubscription.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
        include: { organization: { select: { name: true, type: true } } },
      });
      return toSubscription(reactivated);
    }

    try {
      const created = await this.prisma.organizationSubscription.create({
        data: { organizationId, userId, status: 'ACTIVE' },
        include: { organization: { select: { name: true, type: true } } },
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
  async unsubscribe(userId: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.organizationSubscription.findFirst({
      where: { organizationId, userId },
    });
    if (!existing) throw new NotFoundException('Subscription not found');
    await this.prisma.organizationSubscription.delete({
      where: { id: existing.id },
    });
  }

  async listSubscriptions(userId: string) {
    const rows = await this.prisma.organizationSubscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { organization: { select: { name: true, type: true } } },
    });
    return rows.map(toSubscription);
  }

  private async requireActiveOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, type: true, status: true },
    });
    if (
      !organization ||
      !['HOSPITAL', 'BLOOD_CENTRE'].includes(organization.type) ||
      organization.status !== 'ACTIVE'
    ) {
      throw new UnprocessableEntityException('Organization is not eligible');
    }
    return organization;
  }
}

function toSubscription(row: {
  id: string;
  organizationId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  organization: { name: string; type: string };
}): OrganizationSubscription {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationType: row.organization
      .type as OrganizationSubscription['organizationType'],
    status: row.status as OrganizationSubscription['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
