export { z, ZodError } from 'zod';
export type { ZodIssue, ZodType } from 'zod';
export type InferSchema<TSchema extends import('zod').ZodType> =
  import('zod').infer<TSchema>;
