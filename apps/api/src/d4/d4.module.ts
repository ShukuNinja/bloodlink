import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { D4Controller } from './d4.controller';
import { D4ScaffoldService } from './d4-scaffold.service';
import { MatchingService } from '../matching/matching.service';
import { ResponsesService } from '../responses/responses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationService } from '../communication/communication.service';
import { DonationsService } from '../donations/donations.service';
import { DonorProfileService } from '../donor-profile/donor-profile.service';
import { HospitalSubscriptionsService } from '../hospital-subscriptions/hospital-subscriptions.service';

/** OWNER: D4 | PURPOSE: Register D4 route placeholders. | ENDPOINT/METHOD: D4 API routes. | INPUT: Nest module dependencies. | OUTPUT: Guarded 501 scaffold. | AUTHORIZATION: Existing JWT/Roles guards. | DEPENDENCIES: AuthModule. | STATE CHANGES: None. | NON-RESPONSIBILITIES: D3 workflows or D4 business behavior. | IMPLEMENTATION: TODO(D4). */
@Module({
  imports: [AuthModule],
  controllers: [D4Controller],
  providers: [
    D4ScaffoldService,
    MatchingService,
    ResponsesService,
    NotificationsService,
    CommunicationService,
    DonationsService,
    DonorProfileService,
    HospitalSubscriptionsService,
  ],
})
export class D4Module {}
