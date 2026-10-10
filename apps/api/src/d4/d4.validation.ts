/**
 * OWNER: D4
 * PURPOSE: D4-local pagination normalization and documented matching
 * constants. Pagination mirrors the approved lead decision used by D2/D3:
 * page defaults to 1, page size to 20, maximum 100, database-layer
 * pagination with deterministic ordering and accurate metadata.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function normalizeD4Pagination(query: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number; skip: number } {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/**
 * Matching radii for the notification tiers. The nearest-donor tier reuses
 * the lead-approved 25 km discovery default; the expanding-radius tier
 * widens to 100 km. Distances are computed on the canonical PostGIS
 * geography column — no Haversine and no duplicate coordinate storage.
 */
export const NEAREST_TIER_RADIUS_METERS = 25_000;
export const EXPANDING_TIER_RADIUS_METERS = 100_000;

export const REQUEST_STATUSES_OPEN_FOR_RESPONSES = [
  'OPEN',
  'RESPONSES_RECEIVED',
  'COVERED',
  'COORDINATING',
  'BACKUP_REQUIRED',
] as const;
