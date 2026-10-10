import { Injectable } from '@nestjs/common';
import type {
  HospitalSearchRequest,
  HospitalSummary,
} from '@bloodlink/contracts';
import { HospitalsRepository } from './hospitals.repository';

/**
 * Default discovery radius applied when the caller does not supply
 * radiusMeters. LEAD DECISION D1 (APPROVED, D2 approval record): 25,000
 * metres. An explicitly supplied radiusMeters that is valid under the shared
 * hospitalSearchSchema is always honored instead.
 */
export const DEFAULT_SEARCH_RADIUS_METERS = 25_000;

/**
 * OWNER: D2
 * PURPOSE: Hospital discovery policy for individuals.
 * ENDPOINT/METHOD: GET /api/v1/hospitals.
 * INPUT: Transient caller coordinates plus optional radiusMeters and query.
 * OUTPUT: Shared HospitalSummary projections only.
 * AUTHORIZATION: INDIVIDUAL enforced by the route guards.
 * DEPENDENCIES: HospitalsRepository (PostGIS), shared hospitalSearchSchema.
 * STATE CHANGES: None; caller coordinates are never persisted.
 * NON-RESPONSIBILITIES: District-boundary search, Haversine math, donor
 * coordinates, organization internals, or medical decisions.
 */
@Injectable()
export class HospitalsService {
  constructor(private readonly repository: HospitalsRepository) {}

  async search(input: HospitalSearchRequest): Promise<HospitalSummary[]> {
    const rows = await this.repository.searchNearby({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS,
      namePattern: input.query
        ? `%${escapeLikePattern(input.query)}%`
        : undefined,
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
