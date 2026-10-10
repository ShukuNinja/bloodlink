# Implementation Status and Developer Handoff

**Purpose:** Separate working implementation from intentional scaffolding so incoming developers can take ownership without mistaking a registered method for a completed feature.

**Scope:** Web client + API only. Mobile remains out of scope.

## Reviewed repository files

The following status is based on the source files reviewed for the handoff. Developers must verify the current `main` checkout and rerun the quality gates after pulling; this table is not a substitute for source review.

| File | Current implementation status | Handoff instruction |
|---|---|---|
| `apps/api/src/hospitals/hospitals.repository.ts` | Implemented PostGIS nearby-hospital query. Filters active hospital organizations with a canonical non-null location, applies radius filtering, supports optional name filtering, and orders by distance/name. | Treat as an implemented repository operation. Verify service-level input validation, API projection/contract, and integration coverage before extending it. |
| `apps/api/src/donor-profile/donor-profile.repository.ts` | Intentional scaffold. `findOwn()` and `updateOwn()` throw `NotImplementedException`; no profile persistence is implemented in this file. | D4 owns implementation. Resolve the documented profile creation/status and missing-profile/empty-patch/location-clearing contracts before coding. Keep safe projection and ownership tests. |
| `apps/api/src/hospital-subscriptions/hospital-subscriptions.repository.ts` | Intentional scaffold. `subscribe()`, `unsubscribe()`, and `listForDonor()` throw `NotImplementedException`; no subscription persistence is implemented in this file. | D4 owns implementation. Resolve duplicate/idempotency/reactivation semantics. Verify server-confirmed UI state and the actual notification path; do not promise push delivery without evidence. |
| `apps/api/src/responses/donor-responses.repository.ts` | Intentional scaffold. `acceptDonor()` and `withdrawDonor()` throw `NotImplementedException`; response transitions are not implemented. | D4 owns implementation after response lifecycle/idempotency and withdrawal-race contracts are approved. Never mutate D3-owned `BloodRequest` or `ResponderAssignment` state. |

> **Important:** `NotImplementedException` in these three D4 repositories is deliberate scaffolding for developer handoff, not a reason by itself to omit the files from the commit. It must be documented as unfinished functionality, and the UI must not present these workflows as successful until the backend is implemented and verified.

## Baseline quality-gate results

The most recently reported local run passed:

- Web typecheck
- Web lint
- Web tests: 11 passed
- Web production build
- API typecheck
- API tests: 130 passed
- `git diff --check` was **not clean** at that time: `apps/api/src/patient-needs/patient-needs.repository.ts` had trailing whitespace. Rerun it after the whitespace fix.

These are historical results from before the final handoff commit, not proof that the final commit or all end-to-end workflows pass. Rerun the complete quality gates after the final source/documentation edits.

## Handoff checklist for each developer

1. Pull `main` with `git pull --ff-only origin main` only from a clean checkout.
2. Read `PRODUCT_SCOPE_AND_DOMAIN_RULES.md`, `API_CONTRACTS_AND_MODULE_OWNERSHIP.md`, and the relevant module-specific sections before coding.
3. Confirm ownership and contract blockers with the lead; do not infer state-transition rules from TODO comments.
4. Implement one vertical slice at a time, with tests for authorization, persistence, failure paths, and concurrency where relevant.
5. Keep unimplemented API workflows visibly unavailable or clearly marked; never fake success in the UI.
6. Report what is complete, incomplete, blocked, and tested. Distinguish unit/integration test results from browser-level end-to-end validation.

## Excluded from this status assertion

This document does not assert that the entire application is feature-complete. Passing unit tests and a production build do not establish that hospital subscriptions, donor profiles, donor responses, notifications, or all role-specific browser journeys work end to end.
