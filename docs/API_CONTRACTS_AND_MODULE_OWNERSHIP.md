# API Contracts and Module Ownership

## 1. API client conventions

- Use the shared web API client; do not scatter raw `fetch` calls across components.
- The web app’s same-origin `/api` proxy forwards to the API origin (default `http://localhost:3001`).
- Preserve the `{ "data": ... }` success and `{ "error": ... }` error envelopes.
- Centralize authentication, JSON serialization, error normalization, and request cancellation where supported.
- Avoid duplicating API types in multiple modules. Reuse shared contracts when available.
- Never log tokens, passwords, secret values, or sensitive donor data.

## 2. Known route families

The following are known route families from the project’s prior route inventory. Verify route registration, guards, DTOs, status codes, and response shapes in the current checkout before relying on any endpoint.

| Capability | Known endpoint/route family | Owner / notes |
|---|---|---|
| Health | `GET /api/v1/health` | Operational check |
| Authentication | `/api/v1/auth/...` | Follow current auth implementation |
| Hospital discovery | `GET /api/v1/hospitals` | D2; previously required coordinates and optional `radiusMeters` |
| Hospital subscription | `POST /api/v1/hospitals/:id/subscription` | D4; subscribe current user to hospital |
| Hospital unsubscribe | `DELETE /api/v1/hospitals/:id/subscription` | D4 |
| PatientNeed | `/api/v1/patient-needs/...` | D2 owns create/read/history/cancel |
| Official BloodRequest | `/api/v1/blood-requests/...` | D3 owns lifecycle |
| Donor profile and responses | Current registered routes | D4 |
| Organization responses and subscriptions | Current registered routes | D4 |
| Notifications and communication | Current registered routes | D4; inspect exact delivery guarantees |

Route registration is not proof that the workflow is complete. Check controller → service → repository → database behavior and tests.

## 3. Ownership boundaries

### D2 — PatientNeed and hospital discovery

D2 owns:
- Individual PatientNeed create/read/history/cancel.
- Hospital discovery.

D2 must not write:
- `BloodRequest`
- `ResponderAssignment`
- `DonorResponse`
- `OrganizationResponse`

PatientNeed is a hospital review handoff, not an official BloodRequest.

### D3 — hospital review and official request lifecycle

D3 owns:
- Hospital review/verify/reject of PatientNeeds.
- Creation and lifecycle of official BloodRequests.
- ResponderAssignment state.

D3 is the sole writer for BloodRequest lifecycle and assignment state.

### D4 — responses, donor profiles, subscriptions, and coordination

D4 owns:
- Donor profiles.
- DonorResponse and OrganizationResponse.
- Hospital subscriptions.
- Notifications and communication boundaries.
- DonationRecord, subject to the agreed fulfilment contract.

D4 must not mutate D3-owned BloodRequest or ResponderAssignment lifecycle state.

## 4. Hospital subscription API expectations

Known endpoints:

- `POST /api/v1/hospitals/:id/subscription`
- `DELETE /api/v1/hospitals/:id/subscription`

Before finalizing the web integration, confirm:

- Authentication guard and ownership identity.
- Whether the API returns the created/deleted subscription or a minimal status.
- Duplicate subscription behavior and HTTP status.
- Unsubscribe behavior for a missing subscription.
- Whether hospital eligibility/status is checked.
- How the current user’s subscription state is loaded for list rendering.
- How a subscription triggers notification creation or delivery when the hospital posts a BloodRequest.
- Whether notification preferences and opt-out settings apply.
- Whether notifications are push, in-app, or another implemented channel.
- Idempotency and race behavior for concurrent subscribe/unsubscribe operations.

The frontend should expose a small service abstraction such as `subscribeToHospital(hospitalId)` and `unsubscribeFromHospital(hospitalId)` that uses the shared API client. Use the repository’s established naming and folder conventions rather than introducing a competing architecture.

## 5. Known cross-module questions that require verification/approval

Do not silently invent behavior for:
- BloodRequest transition table and D3/D4 response event boundary.
- Whether fulfilment is distinct from DonationRecord confirmation.
- Response lifecycle and delivery separation/idempotency.
- Conversation identity and participant authorization.
- Blood-bank organization context and safe projections.
- Response withdrawal when D3 assignments exist.
- Donor profile creation/status and missing-profile behavior.
- Subscription semantics, notification visibility, and matching rules.
- `respondedAt` versus `confirmedAt`.
- Empty patch semantics and location clearing.
- UUID and validation error behavior.
- Push/donation endpoint behavior.
- POST status-code conventions.

Use the code and tests to identify the current truth; escalate unresolved product decisions instead of making incompatible assumptions.

## 6. Security and privacy

- Server-side authorization is mandatory; hiding a button is not authorization.
- Enforce ownership and organization membership on the API.
- Only participants in an authorized request-scoped workflow may access its communication.
- Never expose precise donor coordinates in ordinary API projections.
- Validate UUIDs, DTOs, pagination, and state transitions server-side.
- Do not return ORM objects blindly; use explicit safe response projections.
