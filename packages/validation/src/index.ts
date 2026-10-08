import { z } from 'zod';
import type {
  LoginInput,
  LogoutInput,
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
