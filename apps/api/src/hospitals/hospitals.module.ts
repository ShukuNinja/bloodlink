import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';

@Module({
  imports: [AuthModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
})
export class HospitalsModule {}
