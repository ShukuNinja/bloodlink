import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: DonationRecord boundary. BloodLink deliberately keeps donation
 * confirmation OUT of donor self-service: records exist only when hospital
 * workflows confirm them, and no donor-facing route here creates one.
 * BloodLink also never computes medical eligibility or universal cooldowns;
 * `lastConfirmedDonationAt`/`eligibleFrom` are informational profile fields
 * only.
 * STATE CHANGES: None exposed through D4 routes.
 * NON-RESPONSIBILITIES: Medical screening, collection, or issuance.
 */
@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Read-only count used by verification suites and future hospital flows. */
  async countForRequest(bloodRequestId: string): Promise<number> {
    return this.prisma.donationRecord.count({ where: { bloodRequestId } });
  }
}
