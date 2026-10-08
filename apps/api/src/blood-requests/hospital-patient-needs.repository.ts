import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  HospitalPatientNeedQuery,
  PatientNeedRecord,
} from '@bloodlink/contracts';

/**
 * OWNER: D3
 * PURPOSE: Scaffold hospital-scoped PatientNeed persistence access.
 * ENDPOINT/METHOD: Supports hospital review, verify, and reject routes.
 * INPUT: Authenticated user ID, PatientNeed ID, review query.
 * OUTPUT: Existing PatientNeed contract records.
 * AUTHORIZATION: Every lookup must verify active membership in the record's HOSPITAL organization.
 * DEPENDENCIES: Central PrismaService and D2 PatientNeed model.
 * STATE CHANGES: TODO(D3) verified/rejected transitions only.
 * NON-RESPONSIBILITIES: PatientNeed creation/cancellation or D2 behavior.
 * IMPLEMENTATION: TODO(D3).
 */
@Injectable()
export class HospitalPatientNeedsRepository {
  async findManyForUser(
    _userId: string,
    _query: HospitalPatientNeedQuery,
  ): Promise<PatientNeedRecord[]> {
    void _userId;
    void _query;
    throw new NotImplementedException('TODO(D3): list hospital PatientNeeds');
  }

  async findOneForUser(
    _userId: string,
    _patientNeedId: string,
  ): Promise<PatientNeedRecord> {
    void _userId;
    void _patientNeedId;
    throw new NotImplementedException(
      'TODO(D3): retrieve hospital PatientNeed',
    );
  }

  async verifyForUser(_userId: string, _patientNeedId: string): Promise<never> {
    void _userId;
    void _patientNeedId;
    throw new NotImplementedException('TODO(D3): verify PatientNeed');
  }

  async rejectForUser(_userId: string, _patientNeedId: string): Promise<never> {
    void _userId;
    void _patientNeedId;
    throw new NotImplementedException('TODO(D3): reject PatientNeed');
  }
}
