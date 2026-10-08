import { z } from 'zod';
import type {
  LoginInput,
  LogoutInput,
  CreatePatientNeedRequest,
  HospitalSearchRequest,
  RefreshInput,
  RegisterInput,
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

export const registerInputSchema: z.ZodType<RegisterInput> = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const loginInputSchema: z.ZodType<LoginInput> = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshInputSchema: z.ZodType<RefreshInput> = z.strictObject({
  refreshToken: z.string().min(1).max(8192),
});

export const logoutInputSchema: z.ZodType<LogoutInput> = refreshInputSchema;

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
