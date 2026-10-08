import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PatientNeedsController } from './patient-needs.controller';
import { PatientNeedRepository } from './patient-needs.repository';
import { PatientNeedsService } from './patient-needs.service';

@Module({
  imports: [AuthModule],
  controllers: [PatientNeedsController],
  providers: [PatientNeedsService, PatientNeedRepository],
})
export class PatientNeedsModule {}
