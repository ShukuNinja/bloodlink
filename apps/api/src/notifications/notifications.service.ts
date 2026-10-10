import { Injectable } from '@nestjs/common';
import type {
  MatchingTier,
  NotificationBoundary,
  PushSubscription,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: Notification composition and delivery-target selection.
 * PRIVACY: Payloads contain only blood group, component, urgency, and the
 * hospital name — never patient identity and never precise donor location.
 * TIERING: NEAREST_DONORS -> HOSPITAL_SUBSCRIBERS -> EXPANDING_RADIUS;
 * escalation stops after the final tier.
 * STATE CHANGES: None here; delivery side-effects are out of scope for the
 * MVP boundary and only the selection/composition logic is implemented.
 * NON-RESPONSIBILITIES: Medical content, response mutation, D3 lifecycle.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
