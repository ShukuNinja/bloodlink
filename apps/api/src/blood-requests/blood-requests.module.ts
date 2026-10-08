import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BloodRequestsController } from './blood-requests.controller';
import { BloodRequestsRepository } from './blood-requests.repository';
import { BloodRequestsService } from './blood-requests.service';
import { HospitalPatientNeedsController } from './hospital-patient-needs.controller';
import { HospitalPatientNeedsRepository } from './hospital-patient-needs.repository';
import { HospitalPatientNeedsService } from './hospital-patient-needs.service';
import { ResponderAssignmentsRepository } from './responder-assignments/responder-assignments.repository';
import { ResponderAssignmentsService } from './responder-assignments/responder-assignments.service';

/**
 * OWNER: D3
 * PURPOSE: Register D3 hospital review, BloodRequest, and assignment boundaries.
 * ENDPOINT/METHOD: D3 hospital PatientNeed and BloodRequest routes.
 * INPUT: Module dependencies.
 * OUTPUT: TODO(D3) guarded route skeletons.
 * AUTHORIZATION: Existing JWT and hospital role guards.
 * DEPENDENCIES: AuthModule and D3-local providers.
 * STATE CHANGES: None.
 * NON-RESPONSIBILITIES: D2 module ownership and D4 response models.
 * IMPLEMENTATION: TODO(D3).
 */
@Module({
  imports: [AuthModule],
  controllers: [BloodRequestsController, HospitalPatientNeedsController],
  providers: [
    BloodRequestsRepository,
    BloodRequestsService,
    HospitalPatientNeedsRepository,
    HospitalPatientNeedsService,
    ResponderAssignmentsRepository,
    ResponderAssignmentsService,
  ],
})
export class BloodRequestsModule {}
