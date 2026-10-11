import { Injectable } from '@nestjs/common';
import type { Prisma } from '../database/generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * PURPOSE: DonationRecord boundary. BloodLink deliberately keeps donation
 * confirmation OUT of donor self-service: records are created transactionally
 * when a hospital confirms fulfillment for a selected Individual donor.
 * BloodLink also never computes medical eligibility or universal cooldowns;
 * `lastConfirmedDonationAt`/`eligibleFrom` are informational profile fields
 * only.
 * STATE CHANGES: DonationRecord only, called by the D3 fulfillment boundary.
 * NON-RESPONSIBILITIES: Medical screening, collection, or issuance.
 */
@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Read-only count used by verification suites and future hospital flows. */
  async countForRequest(bloodRequestId: string): Promise<number> {
    return this.prisma.donationRecord.count({ where: { bloodRequestId } });
  }

  recordConfirmedDonorDonation(
    transaction: Prisma.TransactionClient,
    input: {
      donorUserId: string;
      bloodRequestId: string;
      confirmedAt: Date;
      confirmedByUserId: string;
    },
  ) {
    return transaction.donationRecord.create({ data: input });
  }
}
