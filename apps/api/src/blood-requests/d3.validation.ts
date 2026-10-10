/**
 * OWNER: D3
 * PURPOSE: D3-local pagination normalization and documented lifecycle
 * constants. LEAD DECISION (D3 approval record): page defaults to 1, page
 * size to 20, maximum page size 100, pagination applied at the database
 * query layer with deterministic ordering and accurate metadata. Mirrors the
 * D2 convention so both domains behave identically.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type D3PaginationInput = {
  page?: number;
  pageSize?: number;
};

export function normalizeD3Pagination(query: D3PaginationInput): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/**
 * BloodRequest states in which hospital-side coordination may still be
 * altered (cancellation allowed, responder selection allowed). Once a
 * request leaves this set toward fulfillment, D3 treats it as locked.
 */
export const PRE_FULFILLMENT_REQUEST_STATUSES = [
  'OPEN',
  'RESPONSES_RECEIVED',
  'COVERED',
  'COORDINATING',
  'BACKUP_REQUIRED',
] as const;
