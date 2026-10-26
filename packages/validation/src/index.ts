import { z } from 'zod';
import type {
  LoginInput,
  LogoutInput,
  CreatePatientNeedRequest,
  AssignResponderRequest,
  BloodRequestListQuery,
  HospitalPatientNeedQuery,
  HospitalSearchRequest,
  OrganizationSearchRequest,
  RefreshInput,
  RegisterInput,
  DonorProfileUpdate,
  DonorBloodRequestQuery,
  CreateMessageRequest,
  OpenOrganizationConversationRequest,
  CreatePushSubscriptionRequest,
  AdminRecordListQuery,
} from '@bloodlink/contracts';
export { z, ZodError } from 'zod';
export type { ZodIssue, ZodType } from 'zod';
export type InferSchema<TSchema extends import('zod').ZodType> =
  import('zod').infer<TSchema>;

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);

export const registerInputSchema: z.ZodType<RegisterInput> = z
  .strictObject({
    email: emailSchema,
    password: passwordSchema,
    accountType: z.enum(['INDIVIDUAL', 'HOSPITAL', 'BLOOD_CENTRE']).optional(),
    organizationName: z.string().trim().min(1).max(255).optional(),
    location: z
      .strictObject({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  })
  .superRefine((input, context) => {
    const accountType = input.accountType ?? 'INDIVIDUAL';
    const isOrganization =
      accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE';
    if (isOrganization && !input.organizationName) {
      context.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Organization name is required for this account type',
      });
    }
    if (isOrganization && !input.location) {
      context.addIssue({
        code: 'custom',
        path: ['location'],
        message: 'Coordinates are required for organization accounts',
      });
    }
    if (!isOrganization && input.organizationName !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Organization name is only valid for organization accounts',
      });
    }
    if (!isOrganization && input.location !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['location'],
        message: 'Coordinates are only valid for organization accounts',
      });
    }
  });

export const loginInputSchema: z.ZodType<LoginInput> = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshInputSchema: z.ZodType<RefreshInput> = z.strictObject({
  refreshToken: z.string().min(1).max(8192),
});

export const logoutInputSchema: z.ZodType<LogoutInput> = refreshInputSchema;

export const adminRecordListQuerySchema: z.ZodType<AdminRecordListQuery> =
  z.strictObject({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  });

export const CreatePatientNeedSchema: z.ZodType<CreatePatientNeedRequest> =
  z.strictObject({
    hospitalId: z.string().min(1),
    bloodGroup: z.enum([
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ]),
    component: z.enum([
      'WHOLE_BLOOD',
      'RED_BLOOD_CELLS',
      'PLATELETS',
      'PLASMA',
    ]),
    units: z.number().int().positive(),
    urgency: z.enum(['ROUTINE', 'URGENT', 'CRITICAL']),
    requiredBy: z.iso.datetime({ offset: true }),
    additionalNotes: z.string().trim().min(1),
  });

export const hospitalSearchSchema: z.ZodType<HospitalSearchRequest> =
  z.strictObject({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().finite().positive().optional(),
    query: z.string().trim().min(1).optional(),
  });

export const organizationSearchSchema: z.ZodType<OrganizationSearchRequest> = z
  .strictObject({
    query: z.string().trim().max(255).optional(),
    type: z.enum(['HOSPITAL', 'BLOOD_CENTRE']).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusMeters: z.coerce.number().finite().positive().optional(),
    sortOrder: z.enum(['ASC', 'DESC']).optional(),
  })
  .superRefine((input, context) => {
    const hasLatitude = input.latitude !== undefined;
    const hasLongitude = input.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: 'custom',
        message: 'Latitude and longitude must be provided together.',
        path: [hasLatitude ? 'longitude' : 'latitude'],
      });
    }
    if (input.radiusMeters !== undefined && !hasLatitude) {
      context.addIssue({
        code: 'custom',
        message: 'A location is required when using a radius filter.',
        path: ['radiusMeters'],
      });
    }
  });

const patientNeedStatusSchema = z.enum([
  'PENDING_HOSPITAL_REVIEW',
  'VERIFIED',
  'REJECTED',
  'CANCELLED',
]);

const bloodRequestStatusSchema = z.enum([
  'OPEN',
  'RESPONSES_RECEIVED',
  'COVERED',
  'COORDINATING',
  'BACKUP_REQUIRED',
  'FULFILLMENT_PENDING',
  'FULFILLMENT_CONFIRMED',
  'FULFILLED',
  'CANCELLED',
]);

const paginationQueryFields = {
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
};

export const hospitalPatientNeedQuerySchema: z.ZodType<HospitalPatientNeedQuery> =
  z.strictObject({
    ...paginationQueryFields,
    status: patientNeedStatusSchema.optional(),
  });

export const bloodRequestListQuerySchema: z.ZodType<BloodRequestListQuery> =
  z.strictObject({
    ...paginationQueryFields,
    status: bloodRequestStatusSchema.optional(),
  });

const responderAssignmentRequestSchema: z.ZodType<AssignResponderRequest> =
  z.strictObject({
    responseType: z.enum(['DONOR_RESPONSE', 'ORGANIZATION_RESPONSE']),
  });

const optionalEmptyActionSchema = z.union([z.undefined(), z.strictObject({})]);

export const cancelBloodRequestSchema = optionalEmptyActionSchema;
export const selectResponderSchema = responderAssignmentRequestSchema;
export const standbyResponderSchema = responderAssignmentRequestSchema;
export const releaseResponderSchema = responderAssignmentRequestSchema;
export const fulfillmentStartSchema = optionalEmptyActionSchema;
export const fulfillmentConfirmSchema = optionalEmptyActionSchema;

const donorAvailabilitySchema = z.enum(['AVAILABLE', 'UNAVAILABLE']);
const donorPreferenceSchema = z.enum([
  'ALL',
  'URGENT_ONLY',
  'CRITICAL_ONLY',
  'NONE',
]);
const donorCoordinationSchema = z.enum(['ACTIVE', 'PAUSED']);
const coordinationResponseStatusSchema = z.enum([
  'NOTIFIED',
  'ACCEPTED',
  'WITHDRAWN',
  'EXPIRED',
]);
const hospitalSubscriptionStatusSchema = z.enum(['ACTIVE', 'PAUSED']);
const conversationStatusSchema = z.enum(['OPEN', 'CLOSED']);
const bloodRequestQueryStatusSchema = bloodRequestStatusSchema;

export const donorProfileUpdateSchema: z.ZodType<DonorProfileUpdate> =
  z.strictObject({
    bloodGroup: z
      .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
      ])
      .optional(),
    availabilityStatus: donorAvailabilitySchema.optional(),
    notificationPreference: donorPreferenceSchema.optional(),
    location: z
      .strictObject({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  });

export const donorBloodRequestQuerySchema: z.ZodType<DonorBloodRequestQuery> =
  z.strictObject({
    ...paginationQueryFields,
    status: bloodRequestQueryStatusSchema.optional(),
  });

export const donorAcceptSchema = optionalEmptyActionSchema;
export const donorWithdrawSchema = optionalEmptyActionSchema;
export const organizationResponseSchema = optionalEmptyActionSchema;
export const hospitalSubscriptionSchema = optionalEmptyActionSchema;

export const createMessageSchema: z.ZodType<CreateMessageRequest> =
  z.strictObject({ content: z.string().trim().min(1) });

export const openOrganizationConversationSchema: z.ZodType<OpenOrganizationConversationRequest> =
  z.strictObject({ sourceOrganizationId: z.uuid() });

export const pushSubscriptionSchema: z.ZodType<CreatePushSubscriptionRequest> =
  z.strictObject({
    platform: z.enum(['MOBILE_ANDROID', 'MOBILE_IOS', 'WEB']),
    endpoint: z.string().trim().min(1),
  });

// Exported enum schemas are for structural input validation only.
export {
  donorAvailabilitySchema,
  donorPreferenceSchema,
  donorCoordinationSchema,
  coordinationResponseStatusSchema,
  hospitalSubscriptionStatusSchema,
  conversationStatusSchema,
};
