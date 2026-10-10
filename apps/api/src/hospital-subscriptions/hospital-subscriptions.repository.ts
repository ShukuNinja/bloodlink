import { Injectable, NotImplementedException } from '@nestjs/common';
import type { HospitalSubscription } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * CALLERS: HospitalSubscriptionsService for donor hospital-network routes.
 * PURPOSE: Repository boundary for HospitalSubscription, separate from device
 *          PushSubscription. These methods intentionally perform no queries.
 * DEPENDENCIES: PrismaService, DonorProfile, HospitalSubscription, HOSPITAL Organization.
 * AUTHORIZATION: Resolve donor ownership from authenticated userId and verify
 *                target organization is a HOSPITAL.
 * STATE: Future operations affect only HospitalSubscription.
 * BLOCKER: C-03 decides pause/delete/reactivate and duplicate/idempotency behavior.
 * TESTS: Cross-user isolation, invalid organization type, duplicate subscribe,
 *        repeat unsubscribe, and reactivation according to approved policy.
 */
@Injectable()
export class HospitalSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {
    void this.prisma;
  }

  /** POST /api/v1/hospitals/:id/subscription; outcome semantics await C-03. */
  async subscribe(
    _userId: string,
    _hospitalId: string,
  ): Promise<HospitalSubscription> {
    void _userId;
    void _hospitalId;
    throw new NotImplementedException('TODO(D4): subscribe to hospital');
  }

  /** DELETE /api/v1/hospitals/:id/subscription; preserve 204 route convention. */
  async unsubscribe(_userId: string, _hospitalId: string): Promise<void> {
    void _userId;
    void _hospitalId;
    throw new NotImplementedException('TODO(D4): unsubscribe from hospital');
  }

  /** GET /api/v1/hospital-subscriptions; read-only, owner-scoped list. */
  async listForDonor(_userId: string): Promise<HospitalSubscription[]> {
    void _userId;
    throw new NotImplementedException('TODO(D4): list donor subscriptions');
  }
}
