import { Injectable } from '@nestjs/common';
import type {
  InAppNotification,
  MatchingTier,
  NotificationBoundary,
  PushSubscription,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';
import { REQUEST_STATUSES_OPEN_FOR_RESPONSES } from '../d4/d4.validation';

/**
 * OWNER: D4
 * PURPOSE: Privacy-safe current request alerts and delivery-target selection.
 * PRIVACY: Payloads contain only blood group, component, urgency, and the
 * hospital name — never patient identity and never precise donor location.
 * TIERING: NEAREST_DONORS -> HOSPITAL_SUBSCRIBERS -> EXPANDING_RADIUS;
 * escalation stops after the final tier.
 * STATE CHANGES: None; the in-app feed is derived from existing request,
 * profile, and subscription records, with no notification history.
 * Push/email/SMS delivery side-effects are out of scope.
 * NON-RESPONSIBILITIES: Medical content, response mutation, D3 lifecycle.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only in-app request alerts derived from current eligible requests.
   * No Notification rows or event history are stored; opening this feed
   * reflects the current matching and subscription state.
   */
  async listForIndividual(userId: string): Promise<InAppNotification[]> {
    const requests = await this.prisma.bloodRequest.findMany({
      where: {
        status: { in: [...REQUEST_STATUSES_OPEN_FOR_RESPONSES] },
        hospital: { type: 'HOSPITAL', status: 'ACTIVE' },
      },
      include: { hospital: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    const answered = await this.listRespondedRequestIds(
      userId,
      requests.map((request) => request.id),
    );
    return requests
      .filter((request) => !answered.has(request.id))
      .map((request) =>
        toInAppNotification(
          {
            id: request.id,
            bloodGroup: request.bloodGroup,
            component: request.component,
            unitsRequired: request.unitsRequired,
            urgency: request.urgency,
            requiredBy: request.requiredBy,
            status: request.status,
            hospitalName: request.hospital.name,
          },
          'NEARBY_MATCH',
        ),
      );
  }

  private async listRespondedRequestIds(userId: string, requestIds: string[]) {
    if (requestIds.length === 0) return new Set<string>();
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
      ? await this.prisma.$queryRaw<Array<{ bloodRequestId: string }>>`
          SELECT "bloodRequestId" FROM "DonorResponse"
          WHERE "userId" = ${userId}::uuid
            AND "bloodRequestId" = ANY(${requestIds}::uuid[])
        `
      : await this.prisma.$queryRaw<Array<{ bloodRequestId: string }>>`
          SELECT response."bloodRequestId"
          FROM "DonorResponse" response
          JOIN "DonorProfile" profile ON profile.id = response."donorId"
          WHERE profile."userId" = ${userId}::uuid
            AND response."bloodRequestId" = ANY(${requestIds}::uuid[])
        `;
    return new Set(rows.map((response) => response.bloodRequestId));
  }

  /** First notification tier for a fresh request. */
  initialTier(): MatchingTier {
    return 'NEAREST_DONORS';
  }

  /** Escalates to the next tier; null once escalation is exhausted. */
  nextTier(current: MatchingTier): MatchingTier | null {
    switch (current) {
      case 'NEAREST_DONORS':
        return 'HOSPITAL_SUBSCRIBERS';
      case 'HOSPITAL_SUBSCRIBERS':
        return 'EXPANDING_RADIUS';
      case 'EXPANDING_RADIUS':
        return null;
    }
  }

  /**
   * Privacy-safe payload: blood group, component, urgency and hospital name
   * only. No patient identifiers, no coordinates.
   */
  composeNotification(
    request: {
      id: string;
      bloodGroup: string;
      component: string;
      urgency: string;
    },
    hospitalName: string,
    recipientUserId: string,
  ): NotificationBoundary {
    return {
      userId: recipientUserId,
      title: `${request.bloodGroup} ${request.component} needed`,
      body: `${hospitalName} has an ${request.urgency} blood request matching your group. Open the app to review it.`,
    };
  }

  /**
   * Notification-preference gate: ALL always; URGENT_ONLY for URGENT or
   * CRITICAL; CRITICAL_ONLY for CRITICAL; NONE never. This is a preference
   * filter, not a medical rule.
   */
  urgencyAllowedByPreference(
    preference: string | null,
    urgency: string,
  ): boolean {
    if (preference === 'ALL') return true;
    if (preference === 'URGENT_ONLY')
      return urgency === 'URGENT' || urgency === 'CRITICAL';
    if (preference === 'CRITICAL_ONLY') return urgency === 'CRITICAL';
    return false;
  }

  /** Enabled push subscriptions for the given users (tier delivery set). */
  async selectPushSubscriptions(
    userIds: string[],
  ): Promise<PushSubscription[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds }, enabled: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform as PushSubscription['platform'],
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
    }));
  }
}

function toInAppNotification(
  request: {
    id: string;
    bloodGroup: string;
    component: string;
    unitsRequired: number;
    urgency: string;
    requiredBy: Date | string;
    status: string;
    hospitalName: string;
  },
  source: InAppNotification['source'],
): InAppNotification {
  const requiredBy =
    request.requiredBy instanceof Date
      ? request.requiredBy.toISOString()
      : request.requiredBy;
  return {
    bloodRequestId: request.id,
    hospitalName: request.hospitalName,
    bloodGroup: request.bloodGroup as InAppNotification['bloodGroup'],
    component: request.component as InAppNotification['component'],
    unitsRequired: request.unitsRequired,
    title: `${request.bloodGroup} ${request.component} needed`,
    body: `A matching request from ${request.hospitalName} is available to review.`,
    urgency: request.urgency as InAppNotification['urgency'],
    requiredBy,
    requestStatus: request.status as InAppNotification['requestStatus'],
    source,
  };
}
