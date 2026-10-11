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
import { D4Module } from '../d4/d4.module';

/**
 * OWNER: D3
 * PURPOSE: Register D3 hospital review, BloodRequest, and assignment boundaries.
 * ENDPOINT/METHOD: D3 hospital PatientNeed and BloodRequest routes.
 * INPUT: Module dependencies.
 * OUTPUT: Guarded hospital PatientNeed review, BloodRequest, and responder-assignment routes.
 * AUTHORIZATION: Existing JWT and hospital role guards.
 * DEPENDENCIES: AuthModule and D3-local providers.
 * STATE CHANGES: None.
 * NON-RESPONSIBILITIES: D2 module ownership and D4 response models.
 * IMPLEMENTATION: D3 controllers, services, and repositories are registered.
 */
@Module({
  imports: [AuthModule, D4Module],
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
