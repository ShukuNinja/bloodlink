import { Injectable } from '@nestjs/common';
import type { DonorProfileUpdate } from '@bloodlink/contracts';
import { DonorProfileService } from '../donor-profile/donor-profile.service';
import { ResponsesService } from '../responses/responses.service';
import { MatchingService } from '../matching/matching.service';
import { CommunicationService } from '../communication/communication.service';
import { HospitalSubscriptionsService } from '../hospital-subscriptions/hospital-subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationCommunicationService } from '../communication/organization-communication.service';
import { PatientNeedCommunicationService } from '../communication/patient-need-communication.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';

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
    private readonly notifications: NotificationsService,
    private readonly organizationCommunication: OrganizationCommunicationService,
    private readonly patientNeedCommunication: PatientNeedCommunicationService,
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

  listDonorResponses(userId: string) {
    return this.responses.listDonorResponses(userId);
  }

  listOrganizationResponses(userId: string) {
    return this.responses.listOrganizationResponses(userId);
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

  listNotifications(userId: string, role: AuthenticatedPrincipal['role']) {
    return this.notifications.listForUser(userId, role);
  }

  getConversation(userId: string, requestId: string) {
    return this.communication.getConversation(userId, requestId);
  }

  createMessage(userId: string, requestId: string, input: { content: string }) {
    return this.communication.createMessage(userId, requestId, input);
  }

  listOrganizationConversations(userId: string) {
    return this.organizationCommunication.listForUser(userId);
  }

  openOrganizationConversation(
    userId: string,
    targetOrganizationId: string,
    sourceOrganizationId: string,
  ) {
    return this.organizationCommunication.openForOrganizations(
      userId,
      targetOrganizationId,
      sourceOrganizationId,
    );
  }

  getOrganizationConversation(userId: string, conversationId: string) {
    return this.organizationCommunication.getForUser(userId, conversationId);
  }

  createOrganizationMessage(
    userId: string,
    conversationId: string,
    input: { content: string },
  ) {
    return this.organizationCommunication.createMessage(
      userId,
      conversationId,
      input,
    );
  }

  listPatientNeedConversations(userId: string) {
    return this.patientNeedCommunication.listForUser(userId);
  }

  getPatientNeedConversation(userId: string, patientNeedId: string) {
    return this.patientNeedCommunication.getForPatientNeed(
      userId,
      patientNeedId,
    );
  }

  createPatientNeedMessage(
    userId: string,
    patientNeedId: string,
    input: { content: string },
  ) {
    return this.patientNeedCommunication.createMessage(
      userId,
      patientNeedId,
      input,
    );
  }
}
