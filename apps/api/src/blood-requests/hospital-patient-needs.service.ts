import { Injectable } from '@nestjs/common';
import type { HospitalPatientNeedQuery } from '@bloodlink/contracts';
import { HospitalPatientNeedsRepository } from './hospital-patient-needs.repository';

/**
 * OWNER: D3
 * PURPOSE: Hospital review application-service boundary for D2 PatientNeeds.
 * ENDPOINT/METHOD: Hospital PatientNeed review routes.
 * INPUT: Authenticated user ID, PatientNeed ID, review query.
 * OUTPUT: Shared review/action response contracts.
 * AUTHORIZATION: HOSPITAL_ADMIN or HOSPITAL_STAFF; target hospital membership is verified in persistence access.
 * DEPENDENCIES: HospitalPatientNeedsRepository and D2 PatientNeed model.
 * STATE CHANGES: TODO(D3) pending-to-verified/rejected only.
 * NON-RESPONSIBILITIES: PatientNeed cancellation, D2 creation, matching, or response creation.
 * IMPLEMENTATION: TODO(D3).
 */
@Injectable()
export class HospitalPatientNeedsService {
  constructor(private readonly repository: HospitalPatientNeedsRepository) {}

  findManyForUser(userId: string, query: HospitalPatientNeedQuery) {
    return this.repository.findManyForUser(userId, query);
  }

  findOneForUser(userId: string, patientNeedId: string) {
    return this.repository.findOneForUser(userId, patientNeedId);
  }

  verifyForUser(userId: string, patientNeedId: string) {
    return this.repository.verifyForUser(userId, patientNeedId);
  }

  rejectForUser(userId: string, patientNeedId: string) {
    return this.repository.rejectForUser(userId, patientNeedId);
  }
}
