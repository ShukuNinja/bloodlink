# Implementation Status and Developer Handoff

**Purpose:** Separate working implementation from intentional scaffolding so incoming developers can take ownership without mistaking a registered method for a completed feature.

**Scope:** Web client + API only. Mobile remains out of scope.

## Integration branch update (2026-10-11)

The web client and API include registration-only account type selection,
role-aware routing, Admin metrics/current-record views, open request discovery
for all Individuals, direct Individual request responses and response history,
Blood Centre response history, hospital subscriptions in discovery, responder
selection/standby/release controls, and request-scoped conversation panels.
Donor and Blood Centre response actions are pending per request row and reload
the server status after failed/ambiguous mutations.
Donor participation is a capability of an Individual account, not a separate
registration role. Organization registration captures canonical PostGIS
coordinates without adding location columns. Individual registration does
not collect display names. Donor responders remain anonymous until selected;
the hospital then sees the account email for coordination. Blood Centre names
remain visible as organization identities. The direct-Individual donor schema
migration is prepared and the Prisma client regenerated with user approval;
the migration has not been applied to the configured development database.

`GET /api/v1/donor/responses` returns only the authenticated Individual's
response records. Advance donor preferences and donor location are not part of
the active Individual workflow; in-app alerts are derived from open requests with no
persisted event/read history. The Admin view
uses current records and aggregates only; the user chose not to add or display
historical event records. Public Admin signup is enabled per the user's
explicit product decision.

`GET /api/v1/blood-centre/responses` returns response statuses only for the
caller’s active Blood Centre memberships. Hospital response references include
Blood Centre names and statuses; Individual donor identities appear only after
hospital selection. Account identifiers and donor coordinates are not exposed
in unselected references. Selected participants can use the existing
request-scoped conversation API through the web panels.

`GET /api/v1/notifications` provides current Individual request alerts derived
from matching and active hospital subscriptions; it does not persist
notification/read history. Hospital fulfillment confirmation creates a
DonationRecord for a selected Individual donor in the same database
transaction as the BloodRequest transition. Confirming a selected Blood Centre
does not create a donor record.

This is an implementation inventory, not a deployable-readiness assertion.
On the current integration checkout, API tests (155/155), web tests (29/29),
API/web lint and typechecks, API compilation, Prisma schema validation, and the
15-route web production build pass. The Individual `/hospitals` access-prefix
regression is covered by the web suite. The checked-in Prisma client remains
untouched. The configured `bloodlink_dev` database is reachable; read-only
migration status reports the existing eight-migration history is up to date,
and no migrations were applied. Authenticated browser end-to-end role journeys
and production environment checks remain outstanding.

## Reviewed repository files

The following status is based on the source files reviewed for the handoff. Developers must verify the current `main` checkout and rerun the quality gates after pulling; this table is not a substitute for source review.

| File | Current implementation status | Handoff instruction |
|---|---|---|
| `apps/api/src/hospitals/hospitals.repository.ts` | Implemented PostGIS nearby-hospital query. Filters active hospital organizations with a canonical non-null location, applies radius filtering, supports optional name filtering, and orders by distance/name. | Treat as an implemented repository operation. Verify service-level input validation, API projection/contract, and integration coverage before extending it. |
| `apps/api/src/donor-profile/donor-profile.repository.ts` | Legacy, unregistered scaffold; `DonorProfileService` now implements owner-scoped Prisma persistence and safe projection directly. | Do not wire the unused repository without consolidating service persistence first. Preserve owner scoping, canonical geography, and no-coordinate response. |
| `apps/api/src/hospital-subscriptions/hospital-subscriptions.repository.ts` | Legacy, unregistered scaffold; `HospitalSubscriptionsService` now implements persistence and active-hospital validation directly. | Keep UI state server-confirmed. Subscription does not imply a request response; push delivery remains unavailable. |
| `apps/api/src/responses/donor-responses.repository.ts` | Legacy, unregistered scaffold; `ResponsesService` now implements donor and organization response persistence directly. | Keep all updates to D4 response rows; never mutate D3-owned `BloodRequest` or `ResponderAssignment` state. |

> **Important:** The `NotImplementedException` methods are in legacy repositories that are not registered in the active modules. They remain unfinished and must not be wired without consolidation. Their presence does not mean the active D4 workflows are unimplemented: the services listed above contain the active persistence paths. API tests cover those paths, while authenticated browser and deployment-environment verification remain outstanding.

## Baseline quality-gate results

The most recently reported local run passed:

- Web typecheck
- Web lint
- Web tests: 11 passed
- Web production build
- API typecheck
- API tests: 130 passed
- `git diff --check` was **not clean** at that time: `apps/api/src/patient-needs/patient-needs.repository.ts` had trailing whitespace. Rerun it after the whitespace fix.

These are historical results from before the integration branch changes, not proof that the final branch or all end-to-end workflows pass. Rerun the complete quality gates after the final source/documentation edits.

## Handoff checklist for each developer

1. Continue this integration work on `integration`. Sync from `main` only with lead direction and only from a clean checkout; preserve the uncommitted working tree and local migrations recorded in `PROGRESS_LOG.md`.
2. Read `PRODUCT_SCOPE_AND_DOMAIN_RULES.md`, `API_CONTRACTS_AND_MODULE_OWNERSHIP.md`, and the relevant module-specific sections before coding.
3. Confirm ownership and contract blockers with the lead; do not infer state-transition rules from TODO comments.
4. Implement one vertical slice at a time, with tests for authorization, persistence, failure paths, and concurrency where relevant.
5. Keep unimplemented API workflows visibly unavailable or clearly marked; never fake success in the UI.
6. Report what is complete, incomplete, blocked, and tested. Distinguish unit/integration test results from browser-level end-to-end validation.

## Excluded from this status assertion

This document does not assert that the entire application is feature-complete. Passing unit tests and a production build do not establish that hospital subscriptions, donor profiles, donor responses, notifications, or all role-specific browser journeys work end to end.
