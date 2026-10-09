import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DonorProfileUpdate } from '@bloodlink/contracts';

/**
 * OWNER: D4
 * PURPOSE: Donor-owned coordination profile boundary.
 * ENDPOINT/METHOD: GET/PATCH donor profile.
 * INPUT: Authenticated owner and shared profile update.
 * OUTPUT: TODO(D4); public representation omits precise location.
 * AUTHORIZATION: Authenticated User who owns the DonorProfile.
 * DEPENDENCIES: Prisma DonorProfile, shared contracts and validation.
 * STATE CHANGES: Coordination preferences and canonical geography only.
 * NON-RESPONSIBILITIES: Medical eligibility or donor location disclosure.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class DonorProfileService {
  getOwnProfile(_userId: string): never {
    void _userId;
    throw new NotImplementedException('TODO(D4): get own donor profile');
  }

  updateOwnProfile(_userId: string, _input: DonorProfileUpdate): never {
    void _userId;
    void _input;
    throw new NotImplementedException('TODO(D4): update own donor profile');
  }
}
