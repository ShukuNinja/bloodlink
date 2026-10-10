import type { ZodType } from '@bloodlink/validation';
import { z } from '@bloodlink/validation';

export type PatientNeedListQueryInput = {
  page?: number;
  pageSize?: number;
};

/**
 * D2-local pagination parsing for GET /api/v1/patient-needs. It mirrors the
 * canonical pagination conventions from the shared validation package
 * (coerced positive integers, optional) and is applied at the API boundary.
 */
export const patientNeedListQuerySchema: ZodType<PatientNeedListQueryInput> =
  z.strictObject({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
  });

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type ParsedPatientNeedPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function parsePatientNeedPagination(
  query: PatientNeedListQueryInput,
): ParsedPatientNeedPagination {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
