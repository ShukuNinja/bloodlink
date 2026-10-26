> **DEPRECATED — HISTORICAL REFERENCE ONLY (2026-10-26).** Use the current [replacement document](../../project/implementation-roadmap.md) and [documentation index](../../README.md). This archived snapshot may contradict the current product or implementation; it is retained for historical context.`r`n`r`n# Implementation Plan and Acceptance Criteria

The checkboxes below are the delivery acceptance target, not a claim that the
current branch has passed every item. See `PROGRESS_LOG.md` for the latest
source and verification checkpoint.

## Guiding rule

Complete the web client and backend as a coherent, testable vertical slice. Do not build mobile features in this delivery. Work from verified API behavior, shared contracts, and approved ownership boundaries.

## Phase 0 — repository and runtime baseline

- [ ] Read `AGENTS.md` and the lead foundation specification.
- [ ] Confirm branch, working tree, Node/pnpm versions, env loading, and database target.
- [ ] Install with the frozen lockfile.
- [ ] Run typecheck, lint, tests, and web build.
- [ ] Start API and web independently.
- [ ] Record baseline failures before modifying code.
- [ ] Confirm test/seed-account setup without destructive database changes.

**Exit condition:** the developer can reproduce the baseline and knows which failures predate their changes.

## Phase 1 — authentication and shared web foundation

- [ ] Confirm login/session/refresh/logout behavior from the actual API.
- [ ] Standardize the shared API client and error normalization.
- [ ] Protect authenticated routes and handle expired sessions.
- [ ] Confirm role-aware navigation and access-denied behavior.
- [ ] Implement consistent loading, empty, error, validation, and mutation-pending states.

**Exit condition:** an authenticated user can navigate to permitted pages, and API failures are handled consistently.

## Phase 2 — hospital discovery and subscriptions

- [ ] Confirm hospital list DTO and subscription-state read mechanism.
- [ ] Render hospital name/details and a Subscribe/Unsubscribe action next to each name.
- [ ] Integrate `POST /api/v1/hospitals/:id/subscription`.
- [ ] Integrate `DELETE /api/v1/hospitals/:id/subscription`.
- [ ] Ensure the UI reflects server-confirmed state and survives refresh/re-login.
- [ ] Prevent duplicate in-flight mutations for a row.
- [ ] Test duplicate subscribe, missing subscription on unsubscribe, permission errors, network failure, and stale list state.
- [ ] Trace what happens when a subscribed hospital posts a BloodRequest.
- [ ] Document the actual notification channel and delivery guarantee; do not claim unsupported real-time push.
- [ ] Decide whether a dedicated “My subscriptions” view is necessary; if added, use the same backend source of truth.

**Exit condition:** a user can subscribe/unsubscribe from the hospital list and see correct persistent state, and the expected request-notification behavior is verified end to end or clearly documented as a backend gap.

## Phase 3 — individual PatientNeed journey

- [ ] Select the hospital where the patient is admitted.
- [ ] Validate and submit PatientNeed data once.
- [ ] Show server-confirmed submission state and detail link.
- [ ] Implement own-history/detail and cancellation where supported.
- [ ] Enforce ownership in the API.
- [ ] Keep PatientNeed separate from official BloodRequest.

**Exit condition:** a real API-created PatientNeed is visible to its owner and enters the hospital review workflow.

## Phase 4 — hospital review and official BloodRequest lifecycle

- [ ] Build incoming PatientNeed queue with loading, empty, error, and pagination behavior.
- [ ] Build review detail.
- [ ] Implement verify/reject actions against the actual API contract.
- [ ] On verification, create the official BloodRequest using the approved workflow.
- [ ] Build request lifecycle UI using server-supported transitions only.
- [ ] Handle responder assignments and fulfillment without bypassing D3 ownership.
- [x] Resolve the fulfillment/DonationRecord boundary: confirming a selected Individual donor creates a DonationRecord in the same transaction; confirming a selected Blood Centre does not create an Individual DonationRecord. The current terminal state is `FULFILLMENT_CONFIRMED`; no later transition to `FULFILLED` is implemented.

**Exit condition:** hospital review produces a distinct official BloodRequest and lifecycle changes persist in the database.

## Phase 5 — donor and organization coordination

- [x] Remove advance donor preference/profile requirements from the active Individual response journey; all open requests are visible to Individuals.
- [ ] Complete donor and organization response journeys.
- [ ] Apply request-specific consent and two-way acceptance where required.
- [ ] Keep communication scoped to authorized request participants.
- [ ] Integrate notification views only to the extent supported by backend delivery.
- [ ] Do not expose precise donor location.
- [ ] Resolve any remaining cross-module contracts with the owner before changing behavior.

**Exit condition:** supported response/coordination workflows can be exercised by real users through the web UI without violating module ownership or consent boundaries.

## Phase 6 — end-to-end hardening

- [ ] Test individual → hospital discovery → subscribe → hospital posts request → notification path.
- [ ] Test individual → PatientNeed → hospital review → official BloodRequest.
- [ ] Test Individual response, Hospital selection, and Blood Centre coordination paths.
- [ ] Test unauthorized access and cross-user data access.
- [ ] Test reloads, repeated clicks, stale state, and network errors.
- [ ] Verify no fake success states, hidden API errors, or console errors.
- [ ] Run all quality gates and record results.

## Global definition of done

A feature is complete only when:
1. The page is reachable through the intended navigation.
2. The UI calls the real API through the shared client.
3. Server-side authorization and validation are present.
4. Data persists and reappears correctly after refresh.
5. Loading, empty, error, and pending states work.
6. Automated tests cover important success and failure cases.
7. The end-to-end path has been exercised with approved test data.
8. Documentation matches the implemented behavior.
9. No unrelated files, secrets, generated dumps, or unapproved contract changes are included.
