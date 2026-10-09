import type { MatchingResultBoundary } from '@bloodlink/contracts';
/** OWNER: D4 | PURPOSE: Matching result boundary only. | ENDPOINT/METHOD: Internal matching service integration. | INPUT: BloodRequest and spatial candidates. | OUTPUT: Tiered candidate boundary. | AUTHORIZATION: Internal API boundary. | DEPENDENCIES: PostGIS and shared contracts. | STATE CHANGES: None. | NON-RESPONSIBILITIES: Matching implementation, medical eligibility, or precise-location exposure. | IMPLEMENTATION: TODO(D4). */
export type MatchingBoundary = MatchingResultBoundary;
