# Domain boundaries and API responsibilities

Updated: 2026-10-26

## Actors and persisted roles

Platform roles are `INDIVIDUAL` and `ADMIN`. Hospital and blood-bank capabilities
are granted through active organization memberships (`HOSPITAL_ADMIN`,
`HOSPITAL_STAFF`, `BLOOD_CENTRE_ADMIN`, or `BLOOD_CENTRE_STAFF`). Do not assume
that a hospital/blood-bank member has a distinct platform role.

## Domain ownership

- **D1 — platform:** repository/workspace foundations, authentication,
  authorization primitives, shared contracts/validation, and integration.
- **D2 — Individual and PatientNeed:** individual PatientNeed submission and
  history; hospital discovery.
- **D3 — hospital and BloodRequest:** hospital PatientNeed review, official
  BloodRequest creation/lifecycle, and responder assignments.
- **D4 — coordination:** donor response, blood-centre response, subscriptions,
  notifications, communication, and donation coordination.

Prisma schema/migrations, contracts, validation, RBAC, root configuration, and
application shells are shared integration surfaces. Cross-domain changes must
preserve the owning domain’s writer boundary.

## Current entity/lifecycle boundaries

- `PatientNeed` is an individual's handoff to a hospital. It is not an official
  blood request.
- A hospital verifies a PatientNeed and may create its `BloodRequest`.
- `BloodRequest` and `ResponderAssignment` lifecycle is D3-owned. D4 response
  operations must not write those states.
- Current BloodRequests are hospital-created. Blood banks respond to them;
  they do not originate requests in the current model.
- Confirmation for a selected Individual creates a DonationRecord under the
  implemented fulfillment contract; a selected Blood Centre does not create an
  Individual DonationRecord. Check current source/tests before changing this.

## Subscriptions and notifications

- Any authenticated user can subscribe to an active Hospital or Blood Centre.
- Individuals cannot be subscription targets.
- Subscription list/change operations are scoped to the authenticated user.
- In-app notification responses are derived from open requests/subscriptions;
  they are not persisted events and do not imply push/email/SMS delivery.
- Individuals retain their open-request feed. Active organization members and
  Admin accounts receive subscribed-hospital request alerts.
- A Blood Centre subscription currently cannot correspond to a BloodRequest
  created by that Blood Centre because the model has no such creation flow.

## Communication boundaries

- General direct conversation is supported between a Hospital and Blood Centre.
- An Individual and Hospital can converse within that individual's verified
  PatientNeed/BloodRequest context.
- Hospitals and Blood Centres must not initiate direct conversations with
  Individuals. The API is the authorization boundary; hiding a UI control is
  not sufficient.
- Existing hospital/responder chat remains request-scoped. Terminal request
  state locks the conversation/actions as implemented.
- There is no individual-to-individual chat or broad social messaging.

## Security/privacy invariants

- Authenticate and authorize on the API for every private resource/action.
- Scope data by owner, active organization membership, and relationship to the
  request/conversation.
- Validate UUIDs, inputs, and state transitions on the server.
- Use explicit safe projections, never raw ORM objects by default.
- Never expose precise individual donor location in normal user-facing output.
- Do not put medical eligibility/screening or blood-bank operations into
  BloodLink business rules.
