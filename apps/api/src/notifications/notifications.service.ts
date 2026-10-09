import { Injectable, NotImplementedException } from '@nestjs/common';
import type { MatchingTier, NotificationBoundary } from '@bloodlink/contracts';

/**
 * OWNER: D4
 * PURPOSE: Privacy-safe notification delivery boundary.
 * ENDPOINT/METHOD: Internal tiered notification delivery.
 * INPUT: Tier and non-patient-identifying notification payload.
 * OUTPUT: TODO(D4); no delivery is attempted in scaffold.
 * AUTHORIZATION: Internal matching workflow.
 * DEPENDENCIES: PushSubscription records and future transport adapters.
 * STATE CHANGES: None in scaffold.
 * NON-RESPONSIBILITIES: Matching decisions, patient-identifying payloads, Expo/Web transport coupling.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class NotificationsService {
  deliverTier(_tier: MatchingTier, _payload: NotificationBoundary): never {
    void _tier;
    void _payload;
    throw new NotImplementedException('TODO(D4): tiered notification delivery');
  }
}
