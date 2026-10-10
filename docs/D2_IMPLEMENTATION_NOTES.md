# D2 Implementation Notes

Status of the D2 (Individual & PatientNeed) domain after end-to-end
implementation of the PatientNeed API, hospital discovery, and the web and
mobile individual journeys.

## Implemented capabilities

| Capability                                                                                                                                                                                                   | Status      | Where                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------- |
| `POST /api/v1/patient-needs` (authenticated INDIVIDUAL, server-assigned owner, canonical schema, hospital eligibility per lead decision D4 — malformed id 400 / ineligible hospital 422 —, 201 + `{ data }`) | Implemented | `apps/api/src/patient-needs/`                                     |
| `GET /api/v1/patient-needs` (owner-scoped, boundary-validated pagination, deterministic order, `{ data, meta }`)                                                                                             | Implemented | `apps/api/src/patient-needs/`                                     |
| `GET /api/v1/patient-needs/:id` (owner-scoped read; foreign/missing records both 404)                                                                                                                        | Implemented | `apps/api/src/patient-needs/`                                     |
| `POST /api/v1/patient-needs/:id/cancel` (owner-scoped conditional write, `PENDING_HOSPITAL_REVIEW` -> `CANCELLED` only, 409 on conflict/repeat)                                                              | Implemented | `apps/api/src/patient-needs/`                                     |
| `GET /api/v1/hospitals` (PostGIS `ST_DWithin` filter, `ST_Distance` ranking, coordinates derived from `Organization.location`, safe `HospitalSummary` projection)                                            | Implemented | `apps/api/src/hospitals/`                                         |
| Web journey (discovery -> select hospital -> submit -> history -> detail -> cancel)                                                                                                                          | Implemented | `apps/web/src/app/...`, `apps/web/src/features/individual/`       |
| Mobile journey (same screens for Expo)                                                                                                                                                                       | Implemented | `apps/mobile/src/app/...`, `apps/mobile/src/features/individual/` |
| Automated coverage (HTTP contract suites, real-database persistence suite, frontend transport suite)                                                                                                         | Implemented | `apps/api/test/`, `apps/web/src/api/client.test.ts`               |

## Lead decisions (approved — D2 approval record)

All five decisions are approved by the lead and implemented accordingly.
None of them changes a lead-owned contract.

1. **D1 — Default hospital search radius: APPROVED at 25,000 metres.**
   `HospitalsService` applies `DEFAULT_SEARCH_RADIUS_METERS = 25_000` when
   `radiusMeters` is omitted; a valid explicit radius is always honored.
   (Note: D2 originally proposed 50,000 m; the lead-approved value is
   25,000 m and the implementation was adjusted to it.)
2. **D2 — Discovery visibility: APPROVED.** Discovery only returns
   organizations with `type = HOSPITAL`, `status = ACTIVE`, and a non-null
   canonical `location`.
3. **D3 — Pagination: APPROVED.** `GET /patient-needs` defaults to
   `page=1`, `pageSize=20`, caps `pageSize` at 100, paginates at the
   database layer, keeps deterministic ordering, and returns metadata
   consistent with the effective page size and filtered count.
4. **D4 — Hospital identifier handling: APPROVED with 422.** Malformed
   `hospitalId` -> HTTP 400; well-formed UUID referencing a missing or
   ineligible hospital -> HTTP 422. The global `{ error }` envelope and
   exception filter are unchanged; no organization details are revealed.
   (Note: D2 originally proposed 404 for ineligible hospitals; the
   lead-approved behavior is 422 and the implementation was adjusted to it.)
5. **D5 — Frontend transport: APPROVED AS INTERIM.** Per-app API clients
   (`apps/web/src/api/`, `apps/mobile/src/api/`) and the Next.js same-origin
   `/api/:path*` proxy remain; they consume canonical contracts only and are
   compatible with a future lead-owned shared API-client foundation.

## Known limitations / verification constraints

- **No PostGIS database is installable in this sandbox.** Outbound access is
  restricted and PostgreSQL/PostGIS cannot be installed. Consequences:
  - The full migration chain was not executed here. The coordinate guard in
    `20261009110000_d4_responses_and_spatial_locations` IS verified by
    execution: `test/migration-guard.spec.cjs` extracts the exact DO block
    from the migration file and runs it on a real PostgreSQL engine against
    representative pre-existing rows (halts with the documented error when a
    HOSPITAL row lacks legacy coordinates; passes otherwise). The spatial
    backfill/constraint remainder of that migration still requires an
    isolated PostGIS database before integration.
  - Hospital search is covered by structural tests asserting the exact
    PostGIS SQL shape (`ST_DWithin` on the geography column with GiST
    index support, `ST_Distance` ranking, bound parameters, escaped ILIKE).
    Execute it once against a real PostGIS database.
  - PatientNeed persistence IS covered against a real PostgreSQL
    wire-protocol server (`test/patient-needs.database.spec.cjs` uses the
    PGlite-based `@prisma/dev` server shipped with the pinned prisma CLI and
    the real Prisma client via `@prisma/adapter-pg`), because that subset of
    the schema needs no PostGIS.
- **`packages/ui` ships no primitives yet.** Web/mobile D2 screens use plain
  semantic elements with a neutral stylesheet and must migrate to the design
  system once it exists.
- **Prisma generate in network-restricted environments.** `prisma generate`
  tries to download the schema engine from binaries.prisma.sh even though the
  Prisma 7 client generator never executes it. In restricted sandboxes set
  `PRISMA_SCHEMA_ENGINE_BINARY` to any executable stub (kept in the local,
  gitignored `apps/api/.env` here).

## Domain boundary preservation

- D2 endpoints never create `BloodRequest`, `ResponderAssignment`,
  `DonorResponse`, or `OrganizationResponse` rows (asserted by tests,
  including a real-database check that those tables stay empty).
- Individuals have no verify/reject route; hospital review remains D3.
- Cancellation is the only lifecycle transition D2 performs, and only from
  `PENDING_HOSPITAL_REVIEW`.
