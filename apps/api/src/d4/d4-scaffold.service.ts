import { Injectable } from '@nestjs/common';
import type { DonorProfileUpdate } from '@bloodlink/contracts';
import { DonorProfileService } from '../donor-profile/donor-profile.service';
import { ResponsesService } from '../responses/responses.service';
import { MatchingService } from '../matching/matching.service';
import { CommunicationService } from '../communication/communication.service';
import { HospitalSubscriptionsService } from '../hospital-subscriptions/hospital-subscriptions.service';

/**
 * OWNER: D4
 * PURPOSE: Facade binding the D4 controller to the D4 sub-domain services.
 * All business rules live in the sub-domain services; this class only
 * routes calls so the controller stays thin.
 * NON-RESPONSIBILITIES: D3 BloodRequest/ResponderAssignment mutation and
 * medical decisions (enforced in the services as well).
 */
@Injectable()
export class D4ScaffoldService {
  constructor(
    private readonly profiles: DonorProfileService,
    private readonly responses: ResponsesService,
    private readonly matching: MatchingService,
    private readonly communication: CommunicationService,
    private readonly subscriptions: HospitalSubscriptionsService,
  ) {}

  getDonorProfile(userId: string) {
    return this.profiles.getOwnProfile(userId);
  }

  updateDonorProfile(userId: string, input: DonorProfileUpdate) {
    return this.profiles.updateOwnProfile(userId, input);
  }

  listDonorRequests(userId: string, query: unknown) {
    return this.matching.listDonorRequests(
      userId,
      query as Parameters<MatchingService['listDonorRequests']>[1],
    );
  }

  getDonorRequest(userId: string, requestId: string) {
    return this.matching.getDonorRequest(userId, requestId);
  }

  acceptRequest(userId: string, requestId: string) {
    return this.responses.acceptDonor(userId, requestId);
  }

  withdrawRequest(userId: string, requestId: string) {
    return this.responses.withdrawDonor(userId, requestId);
  }

  listBloodCentreRequests(userId: string, query: unknown) {
    return this.matching.listBloodCentreRequests(
      userId,
      query as Parameters<MatchingService['listBloodCentreRequests']>[1],
    );
  }

  getBloodCentreRequest(userId: string, requestId: string) {
    return this.matching.getBloodCentreRequest(userId, requestId);
  }

  createOrganizationResponse(userId: string, requestId: string) {
    return this.responses.createOrganizationResponse(userId, requestId);
  }

  withdrawOrganizationResponse(userId: string, requestId: string) {
    return this.responses.withdrawOrganizationResponse(userId, requestId);
  }

  subscribe(userId: string, hospitalId: string) {
    return this.subscriptions.subscribe(userId, hospitalId);
  }

  unsubscribe(userId: string, hospitalId: string) {
    return this.subscriptions.unsubscribe(userId, hospitalId);
  }

  listSubscriptions(userId: string) {
    return this.subscriptions.listSubscriptions(userId);
  }

  getConversation(userId: string, requestId: string) {
    return this.communication.getConversation(userId, requestId);
  }

  createMessage(userId: string, requestId: string, input: { content: string }) {
    return this.communication.createMessage(userId, requestId, input);
  }
}
