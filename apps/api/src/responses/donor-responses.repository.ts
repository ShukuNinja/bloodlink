import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DonorResponse } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * CALLERS: ResponsesService for donor accept/withdraw routes.
 * PURPOSE: Typed persistence boundary for the donor-owned response row only.
 * DEPENDENCIES: PrismaService, DonorProfile, BloodRequest, DonorResponse.
 * AUTHORIZATION: Resolve DonorProfile by authenticated userId; verify the exact
 *                BloodRequest is visible and a NOTIFIED offer exists before action.
 * STATE: No response transition is implemented; never write BloodRequest.status
 *        or ResponderAssignment.
 * BLOCKERS: P0-3 offer lifecycle/idempotency/reactivation and P0-6 assignment
 *           withdrawal race policy. Do not infer allowed statuses here.
 * TESTS: Owner/request isolation, offer prerequisite, duplicate commands,
 *        concurrent accept/withdraw, and no D3-owned writes.
 */
@Injectable()
export class DonorResponsesRepository {
  constructor(private readonly prisma: PrismaService) {
    void this.prisma;
  }

  /**
   * POST /api/v1/blood-requests/:id/accept; verify JWT user's donor profile,
   * request visibility and existing offer, then conditionally change only the
   * DonorResponse row after P0-3 defines its state/idempotency contract.
   */
  async acceptDonor(
    _userId: string,
    _bloodRequestId: string,
  ): Promise<DonorResponse> {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): accept donor response');
  }

  /**
   * POST /api/v1/blood-requests/:id/withdraw; exact state policy and selected/
   * standby assignment race await P0-3/P0-6. D4 must never release D3 assignment.
   */
  async withdrawDonor(
    _userId: string,
    _bloodRequestId: string,
  ): Promise<DonorResponse> {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): withdraw donor response');
  }
}
