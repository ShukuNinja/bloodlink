/**
 * OWNER: D3
 * PURPOSE: Types for hospital-side review of D2-owned PatientNeeds.
 * ENDPOINT/METHOD: GET /hospital/patient-needs[/:id], POST verify/reject.
 * INPUT: Authenticated user ID, PatientNeed ID, and review query.
 * OUTPUT: Existing shared PatientNeed contracts and verification action contract.
 * AUTHORIZATION: HOSPITAL_ADMIN or HOSPITAL_STAFF with active membership in the PatientNeed's hospital.
 * DEPENDENCIES: D2 PatientNeed model, shared contracts, D3 review repository.
 * STATE CHANGES: Verification/rejection only; never cancellation.
 * NON-RESPONSIBILITIES: PatientNeed creation/cancellation and BloodRequest business logic.
 * IMPLEMENTATION: TODO(D3).
 */
import type { HospitalPatientNeedQuery } from '@bloodlink/contracts';

export type { HospitalPatientNeedQuery };
