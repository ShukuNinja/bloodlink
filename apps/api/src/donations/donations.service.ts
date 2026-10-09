import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * OWNER: D4
 * PURPOSE: Authorized donation confirmation/history boundary.
 * ENDPOINT/METHOD: Internal authorized confirmation workflow only.
 * INPUT: Confirmed coordination event and authorized confirmer.
 * OUTPUT: TODO(D4); no DonationRecord is fabricated.
 * AUTHORIZATION: Only an authorized confirmation workflow may invoke this
 * operation; donor acceptance is not donation confirmation. No public or
 * donor-self-service confirmation endpoint exists.
 * DEPENDENCIES: DonationRecord, DonorProfile, BloodRequest and authorized confirmation workflow.
 * STATE CHANGES: DonationRecord and latest coordination dates only when implemented.
 * NON-RESPONSIBILITIES: Screening, testing, crossmatching, transfusion, medical eligibility/cooldown rules.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class DonationsService {
  confirmDonation(_event: unknown): never {
    void _event;
    throw new NotImplementedException(
      'TODO(D4): authorized donation confirmation',
    );
  }
}
