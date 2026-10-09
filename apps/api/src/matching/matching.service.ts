import { Injectable, NotImplementedException } from '@nestjs/common';
import type { MatchingResultBoundary } from '@bloodlink/contracts';

/**
 * OWNER: D4
 * PURPOSE: Deterministic candidate discovery and tier boundary.
 * ENDPOINT/METHOD: Internal matching service.
 * INPUT: BloodRequest identifier and future structural matching input.
 * OUTPUT: MatchingResultBoundary; TODO(D4), no fabricated candidates.
 * AUTHORIZATION: Internal API workflow only.
 * DEPENDENCIES: PostGIS geography, donor profile coordination state, shared contracts.
 * STATE CHANGES: None in scaffold.
 * NON-RESPONSIBILITIES: Medical eligibility, Haversine, all-donor memory scans, notification delivery.
 * IMPLEMENTATION: TODO(D4).
 */
@Injectable()
export class MatchingService {
  discoverCandidates(_input: unknown): never {
    void _input;
    throw new NotImplementedException('TODO(D4): PostGIS candidate discovery');
  }
}

export type MatchingResult = MatchingResultBoundary;
