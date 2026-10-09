import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DonorResponse, OrganizationResponse } from '@bloodlink/contracts';

/**
 * OWNER: D4
 * PURPOSE: Donor and blood-centre response state boundary.
 * ENDPOINT/METHOD: Accept, withdraw, and organization response operations.
 * INPUT: Authenticated owner and BloodRequest/response IDs.
 * OUTPUT: D4 response contracts; TODO(D4), no fabricated records.
 * AUTHORIZATION: Donor profile owner or user with ACTIVE membership in an ACTIVE
 * BLOOD_CENTRE Organization; organization responses must verify organization type.
 * DEPENDENCIES: Prisma response models, D3 BloodRequest read boundary.
 * STATE CHANGES: D4 response records only.
 * NON-RESPONSIBILITIES: BloodRequest lifecycle, ResponderAssignment, matching, donation history.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class ResponsesService {
  acceptDonor(_userId: string, _bloodRequestId: string): never {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): accept donor response');
  }

  withdrawDonor(_userId: string, _bloodRequestId: string): never {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): withdraw donor response');
  }

  respondOrganization(_userId: string, _bloodRequestId: string): never {
    void _userId;
    void _bloodRequestId;
    throw new NotImplementedException('TODO(D4): organization response');
  }
}

export type DonorResponseContract = DonorResponse;
export type OrganizationResponseContract = OrganizationResponse;
