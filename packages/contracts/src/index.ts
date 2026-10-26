export type ApiSuccess<T> = {
  data: T;
};

export type ApiSuccessWithMeta<T, M> = {
  data: T;
  meta: M;
};

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  error: ApiError;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiTimestamp = string;
export type ResourceId = string;

export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type PlatformRole = 'INDIVIDUAL' | 'ADMIN';
export type OrganizationType = 'HOSPITAL' | 'BLOOD_CENTRE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';
export type OrganizationMembershipRole =
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'BLOOD_CENTRE_ADMIN'
  | 'BLOOD_CENTRE_STAFF';
export type OrganizationMembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export type AuthUser = {
  id: ResourceId;
  name: string | null;
  email: string;
  status: UserStatus;
  role: PlatformRole;
  organizations: Array<{
    id: ResourceId;
    name: string;
    type: OrganizationType;
    role: OrganizationMembershipRole;
  }>;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

export type AuthResponse = {
  user: AuthUser;
} & AuthTokens;

export type AdminMetrics = {
  generatedAt: ApiTimestamp;
  accounts: {
    total: number;
    individuals: number;
    admins: number;
    active: number;
    suspended: number;
  };
  organizations: {
    total: number;
    hospitals: number;
    bloodCentres: number;
    active: number;
    suspended: number;
  };
  workflows: {
    patientNeeds: number;
    bloodRequests: number;
    individualResponders: number;
    donorResponses: number;
    organizationResponses: number;
    hospitalSubscriptions: number;
    donationRecords: number;
  };
};
export type AdminMetricsResponse = ApiSuccess<AdminMetrics>;
export type AdminRecordListQuery = {
  page?: number;
  pageSize?: number;
};
export type AdminAccountView = {
  id: ResourceId;
  email: string;
  role: PlatformRole;
  status: UserStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  organizations: Array<{
    id: ResourceId;
    name: string;
    type: OrganizationType;
    status: OrganizationStatus;
    role: OrganizationMembershipRole;
    membershipStatus: OrganizationMembershipStatus;
  }>;
};
export type AdminOrganizationView = {
  id: ResourceId;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  memberCount: number;
};
export type AdminAccountListResponse = ApiSuccessWithMeta<
  AdminAccountView[],
  PaginationMeta
>;
export type AdminOrganizationListResponse = ApiSuccessWithMeta<
  AdminOrganizationView[],
  PaginationMeta
>;

export type RegisterInput = {
  name?: string;
  email: string;
  password: string;
  accountType?: 'INDIVIDUAL' | 'ADMIN' | 'HOSPITAL' | 'BLOOD_CENTRE';
  organizationName?: string;
  location?: { latitude: number; longitude: number };
};

export type UpdateAccountNameRequest = { name: string };

export type LoginInput = Pick<RegisterInput, 'email' | 'password'>;

export type RefreshInput = {
  refreshToken: string;
};

export type LogoutInput = RefreshInput;

export type PatientNeedBloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

export type PatientNeedComponent =
  'WHOLE_BLOOD' | 'RED_BLOOD_CELLS' | 'PLATELETS' | 'PLASMA';

export type PatientNeedUrgency = 'ROUTINE' | 'URGENT' | 'CRITICAL';

export type PatientNeedStatus =
  'PENDING_HOSPITAL_REVIEW' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';

export type CreatePatientNeedRequest = {
  hospitalId: ResourceId;
  patientName: string;
  bloodGroup: PatientNeedBloodGroup;
  component: PatientNeedComponent;
  units: number;
  urgency: PatientNeedUrgency;
  requiredBy: ApiTimestamp;
  additionalNotes: string;
};

export type PatientNeedRecord = {
  id: ResourceId;
  hospitalId: ResourceId;
  patientName: string | null;
  bloodGroup: PatientNeedBloodGroup;
  component: PatientNeedComponent;
  units: number;
  urgency: PatientNeedUrgency;
  requiredBy: ApiTimestamp;
  additionalNotes: string;
  status: PatientNeedStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};

export type PatientNeedResponse = ApiSuccess<PatientNeedRecord>;
export type PatientNeedListResponse = ApiSuccessWithMeta<
  PatientNeedRecord[],
  PaginationMeta
>;

export type HospitalSearchRequest = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  query?: string;
};

export type HospitalSummary = {
  id: ResourceId;
  name: string;
  latitude: number;
  longitude: number;
};

export type HospitalSearchResponse = ApiSuccess<HospitalSummary[]>;

export type OrganizationSearchRequest = {
  query?: string;
  type?: OrganizationType;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  sortOrder?: 'ASC' | 'DESC';
};
export type OrganizationSummary = {
  id: ResourceId;
  name: string;
  type: OrganizationType;
};
export type OrganizationSearchResponse = ApiSuccess<OrganizationSummary[]>;

export type BloodRequestStatus =
  | 'OPEN'
  | 'RESPONSES_RECEIVED'
  | 'COVERED'
  | 'COORDINATING'
  | 'BACKUP_REQUIRED'
  | 'FULFILLMENT_PENDING'
  | 'FULFILLMENT_CONFIRMED'
  | 'FULFILLED'
  | 'CANCELLED';

export type ResponderAssignmentState = 'SELECTED' | 'STANDBY' | 'RELEASED';

export type HospitalPatientNeedQuery = {
  status?: PatientNeedStatus;
  page?: number;
  pageSize?: number;
};

export type HospitalPatientNeedListResponse = ApiSuccessWithMeta<
  PatientNeedRecord[],
  PaginationMeta
>;

export type HospitalPatientNeedResponse = ApiSuccess<PatientNeedRecord>;

export type VerifyPatientNeedResponse = ApiSuccess<{
  patientNeed: PatientNeedRecord;
  bloodRequest: BloodRequestRecord;
}>;

export type RejectPatientNeedResponse = ApiSuccess<PatientNeedRecord>;

export type ResponderResponseType = 'DONOR_RESPONSE' | 'ORGANIZATION_RESPONSE';

export type ResponderResponseReference = {
  responseId: ResourceId;
  responseType: ResponderResponseType;
  status?: CoordinationResponseStatus;
  /** Organization name. Individual donor identities remain anonymous. */
  responderName?: string;
};

export type ResponderAssignmentView = {
  id: ResourceId;
  bloodRequestId: ResourceId;
  response: ResponderResponseReference;
  state: ResponderAssignmentState;
  assignedAt: ApiTimestamp;
  releasedAt?: ApiTimestamp;
};

export type ResponderCoordinationResponse = ApiSuccess<
  ResponderAssignmentView[]
>;
export type ResponderAssignmentResponse = ApiSuccess<ResponderAssignmentView>;

export type ResponderResponseListResponse = ApiSuccess<
  ResponderResponseReference[]
>;

export type AssignResponderRequest = {
  responseType: ResponderResponseType;
};

export type BloodRequestRecord = {
  id: ResourceId;
  hospitalId: ResourceId;
  patientNeedId: ResourceId;
  bloodGroup: PatientNeedBloodGroup;
  component: PatientNeedComponent;
  unitsRequired: number;
  urgency: PatientNeedUrgency;
  requiredBy: ApiTimestamp;
  status: BloodRequestStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};

export type BloodRequest = BloodRequestRecord;
export type BloodRequestSummary = BloodRequestRecord;

export type BloodRequestDetail = BloodRequestRecord & {
  assignments: ResponderAssignmentView[];
};

export type BloodRequestListQuery = {
  status?: BloodRequestStatus;
  page?: number;
  pageSize?: number;
};

export type BloodRequestListResponse = ApiSuccessWithMeta<
  BloodRequestSummary[],
  PaginationMeta
>;

export type BloodRequestDetailResponse = ApiSuccess<BloodRequestDetail>;
export type BloodRequestActionResponse = ApiSuccess<BloodRequestRecord>;

export type BloodRequestCancellationResponse = BloodRequestActionResponse;
export type FulfillmentActionResponse = BloodRequestActionResponse;

export type DonorAvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type DonorNotificationPreference =
  'ALL' | 'URGENT_ONLY' | 'CRITICAL_ONLY' | 'NONE';
export type DonorCoordinationStatus = 'ACTIVE' | 'PAUSED';
export type CoordinationResponseStatus =
  'NOTIFIED' | 'ACCEPTED' | 'WITHDRAWN' | 'EXPIRED';
export type HospitalSubscriptionStatus = 'ACTIVE' | 'PAUSED';
export type ConversationStatus = 'OPEN' | 'CLOSED';
export type PushPlatform = 'MOBILE_ANDROID' | 'MOBILE_IOS' | 'WEB';
export type CreatePushSubscriptionRequest = {
  platform: PushPlatform;
  endpoint: string;
};
export type PushSubscription = {
  id: ResourceId;
  platform: PushPlatform;
  enabled: boolean;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  lastUsedAt?: ApiTimestamp;
};
export type PushSubscriptionResponse = ApiSuccess<PushSubscription>;

export type ApproximateDistance = { approximateDistanceKm: number };

/** Public shape intentionally excludes precise donor coordinates. */
export type DonorProfile = {
  id: ResourceId;
  bloodGroup: PatientNeedBloodGroup;
  availabilityStatus: DonorAvailabilityStatus;
  notificationPreference: DonorNotificationPreference;
  coordinationStatus: DonorCoordinationStatus;
  lastConfirmedDonationAt?: ApiTimestamp;
  eligibleFrom?: ApiTimestamp;
};

export type DonorProfileUpdate = {
  bloodGroup?: PatientNeedBloodGroup;
  availabilityStatus?: DonorAvailabilityStatus;
  notificationPreference?: DonorNotificationPreference;
  location?: { latitude: number; longitude: number };
};

export type DonorProfileResponse = ApiSuccess<DonorProfile>;
export type DonorProfileUpdateResponse = DonorProfileResponse;

export type DonorBloodRequestSummary = Pick<
  BloodRequestRecord,
  | 'id'
  | 'bloodGroup'
  | 'component'
  | 'unitsRequired'
  | 'urgency'
  | 'requiredBy'
  | 'status'
> & { hospitalName: string; approximateDistanceKm?: number };
export type DonorBloodRequestDetail = DonorBloodRequestSummary;
export type DonorBloodRequestQuery = {
  page?: number;
  pageSize?: number;
  status?: BloodRequestStatus;
};
export type DonorBloodRequestListResponse = ApiSuccessWithMeta<
  DonorBloodRequestSummary[],
  PaginationMeta
>;
export type DonorBloodRequestDetailResponse =
  ApiSuccess<DonorBloodRequestDetail>;

export type DonorResponse = {
  id: ResourceId;
  bloodRequestId: ResourceId;
  status: CoordinationResponseStatus;
  respondedAt?: ApiTimestamp;
  confirmedAt?: ApiTimestamp;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};
export type DonorResponseActionResponse = ApiSuccess<DonorResponse>;
export type DonorResponseListResponse = ApiSuccess<DonorResponse[]>;

export type OrganizationResponse = {
  id: ResourceId;
  bloodRequestId: ResourceId;
  organizationId: ResourceId;
  status: CoordinationResponseStatus;
  respondedAt?: ApiTimestamp;
  confirmedAt?: ApiTimestamp;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};
export type OrganizationResponseActionResponse =
  ApiSuccess<OrganizationResponse>;
export type OrganizationResponseListResponse = ApiSuccess<
  OrganizationResponse[]
>;

export type HospitalSubscription = {
  id: ResourceId;
  hospitalId: ResourceId;
  status: HospitalSubscriptionStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};
export type HospitalSubscriptionListResponse = ApiSuccess<
  HospitalSubscription[]
>;
export type HospitalSubscriptionResponse = ApiSuccess<HospitalSubscription>;

export type OrganizationSubscription = {
  id: ResourceId;
  organizationId: ResourceId;
  organizationName: string;
  organizationType: OrganizationType;
  status: HospitalSubscriptionStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
};
export type OrganizationSubscriptionListResponse = ApiSuccess<
  OrganizationSubscription[]
>;
export type OrganizationSubscriptionResponse =
  ApiSuccess<OrganizationSubscription>;

/** Internal matching boundary; donor location is never part of this shape. */
export type MatchingCandidateBoundary = {
  donorId: ResourceId;
  approximateDistanceKm: number;
};
export type MatchingTier =
  'NEAREST_DONORS' | 'HOSPITAL_SUBSCRIBERS' | 'EXPANDING_RADIUS';
export type MatchingResultBoundary = {
  bloodRequestId: ResourceId;
  tier: MatchingTier;
  candidates: MatchingCandidateBoundary[];
};
export type NotificationBoundary = {
  userId: ResourceId;
  title: string;
  body: string;
};

/** Current request alert derived from existing matching/subscription records; no event history is stored. */
export type InAppNotification = {
  bloodRequestId: ResourceId;
  hospitalName: string;
  bloodGroup: PatientNeedBloodGroup;
  component: PatientNeedComponent;
  unitsRequired: number;
  title: string;
  body: string;
  urgency: PatientNeedUrgency;
  requiredBy: ApiTimestamp;
  requestStatus: BloodRequestStatus;
  source: 'NEARBY_MATCH' | 'HOSPITAL_SUBSCRIPTION' | 'BOTH';
};
export type InAppNotificationListResponse = ApiSuccess<InAppNotification[]>;

export type Conversation = {
  id: ResourceId;
  bloodRequestId: ResourceId;
  status: ConversationStatus;
  createdAt: ApiTimestamp;
};
export type Message = {
  id: ResourceId;
  conversationId: ResourceId;
  senderId: ResourceId;
  content: string;
  createdAt: ApiTimestamp;
  readAt?: ApiTimestamp;
};
export type ConversationDetail = Conversation & { messages: Message[] };
export type ConversationResponse = ApiSuccess<ConversationDetail>;
export type MessageResponse = ApiSuccess<Message>;
export type CreateMessageRequest = { content: string };

export type OrganizationConversationSummary = {
  id: ResourceId;
  otherOrganization: OrganizationSummary;
  status: ConversationStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  lastMessage?: Pick<Message, 'content' | 'createdAt' | 'senderId'>;
};
export type OrganizationConversationDetail = {
  id: ResourceId;
  participantA: OrganizationSummary;
  participantB: OrganizationSummary;
  status: ConversationStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  messages: Message[];
};
export type OrganizationConversationListResponse = ApiSuccess<
  OrganizationConversationSummary[]
>;
export type OrganizationConversationResponse =
  ApiSuccess<OrganizationConversationDetail>;
export type OpenOrganizationConversationRequest = {
  sourceOrganizationId: ResourceId;
};

export type PatientNeedConversationSummary = {
  id: ResourceId;
  patientNeedId: ResourceId;
  hospitalName: string;
  status: ConversationStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  lastMessage?: Pick<Message, 'content' | 'createdAt' | 'senderId'>;
};
export type PatientNeedConversationDetail = {
  id: ResourceId;
  patientNeedId: ResourceId;
  hospitalName: string;
  status: ConversationStatus;
  createdAt: ApiTimestamp;
  updatedAt: ApiTimestamp;
  messages: Message[];
};
export type PatientNeedConversationListResponse = ApiSuccess<
  PatientNeedConversationSummary[]
>;
export type PatientNeedConversationResponse =
  ApiSuccess<PatientNeedConversationDetail>;
