import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * OWNER: D4
 * PURPOSE: Donor/hospital voluntary request-network boundary.
 * ENDPOINT/METHOD: Subscribe, unsubscribe, and list subscriptions.
 * INPUT: Authenticated donor owner and hospital ID.
 * OUTPUT: TODO(D4); no fabricated subscriptions.
 * AUTHORIZATION: Verify donor ownership and target HOSPITAL server-side.
 * DEPENDENCIES: HospitalSubscription, DonorProfile and Organization.
 * STATE CHANGES: HospitalSubscription only.
 * NON-RESPONSIBILITIES: Push device subscriptions or arbitrary organization access.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class HospitalSubscriptionsService {
  subscribe(_userId: string, _hospitalId: string): never {
    void _userId;
    void _hospitalId;
    throw new NotImplementedException('TODO(D4): subscribe to hospital');
  }

  unsubscribe(_userId: string, _hospitalId: string): never {
    void _userId;
    void _hospitalId;
    throw new NotImplementedException('TODO(D4): unsubscribe from hospital');
  }

  listForDonor(_userId: string): never {
    void _userId;
    throw new NotImplementedException('TODO(D4): list donor subscriptions');
  }
}
