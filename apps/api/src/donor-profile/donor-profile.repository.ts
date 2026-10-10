import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DonorProfile, DonorProfileUpdate } from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D4
 * CALLERS: DonorProfileService for GET/PATCH /api/v1/donor-profile.
 * PURPOSE: Owner-scoped DonorProfile persistence boundary; methods intentionally
 *          remain 501 and do not read or write the database yet.
 * DEPENDENCIES: PrismaService, DonorProfile model, shared safe DonorProfile DTO.
 * AUTHORIZATION: Always scope by the userId supplied from the authenticated JWT.
 * STATE: Future update writes only allowed coordination fields and canonical
 *        geography; it must never write coordinationStatus/eligibility dates.
 * BLOCKERS: C-02 profile creation/status ownership; C-08 missing-profile behavior;
 *           C-09 empty patch and location clearing.
 * TESTS: Owner isolation, missing profile, safe projection, partial update,
 *        invalid/empty patch, no precise coordinate in return value.
 */
@Injectable()
export class DonorProfileRepository {
  constructor(private readonly prisma: PrismaService) {
    void this.prisma;
  }

  /**
   * GET /api/v1/donor-profile repository operation. Query by unique userId and
   * select only fields represented by DonorProfile; absence maps to the approved
   * not-found contract. Do not select/serialize geography into ordinary output.
   */
  async findOwn(_userId: string): Promise<DonorProfile> {
    void _userId;
    throw new NotImplementedException('TODO(D4): read own DonorProfile');
  }

  /**
   * PATCH /api/v1/donor-profile repository operation. Filter by userId, update
   * only supplied DonorProfileUpdate fields, and convert transient coordinates
   * to canonical DonorProfile.location after C-09 is approved. Keep the result
   * on the public safe projection. No query or write is implemented here.
   */
  async updateOwn(
    _userId: string,
    _input: DonorProfileUpdate,
  ): Promise<DonorProfile> {
    void _userId;
    void _input;
    throw new NotImplementedException('TODO(D4): update own DonorProfile');
  }
}
