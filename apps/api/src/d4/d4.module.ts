import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { D4Controller } from './d4.controller';
import { D4ScaffoldService } from './d4-scaffold.service';
import { MatchingService } from '../matching/matching.service';
import { ResponsesService } from '../responses/responses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationService } from '../communication/communication.service';
import { DonorProfileService } from '../donor-profile/donor-profile.service';
import { HospitalSubscriptionsService } from '../hospital-subscriptions/hospital-subscriptions.service';
import { DonationsModule } from '../donations/donations.module';

/** OWNER: D4 | PURPOSE: Register D4 donor, blood-centre, subscription, and communication routes. | ENDPOINT/METHOD: D4 API routes. | INPUT: Nest module dependencies. | OUTPUT: Guarded D4 workflows. | AUTHORIZATION: Existing JWT/Roles guards plus service-level ownership/membership checks. | DEPENDENCIES: AuthModule and D4 sub-domain services. | STATE CHANGES: D4 profiles, subscriptions, responses, conversations, and messages only. | NON-RESPONSIBILITIES: D3 lifecycle, medical decisions, inventory, or delivery. */
@Module({
  imports: [AuthModule, DonationsModule],
  controllers: [D4Controller],
  providers: [
    D4ScaffoldService,
    MatchingService,
    ResponsesService,
    NotificationsService,
    CommunicationService,
    DonorProfileService,
    HospitalSubscriptionsService,
  ],
  exports: [DonationsModule],
})
export class D4Module {}
