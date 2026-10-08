# BloodLink — Lead Developer Foundation Specification

**Version:** 1.0
**Status:** Foundation Sprint Source of Truth
**Team:** 4 developers
**Lead:** Developer 1
**Sprint:** 4 days
**Foundation Build Target:** 2 hours

---

## 1. Purpose

This document defines the technical foundation that the Lead Developer establishes before feature developers begin implementation.

The Lead owns the architecture, shared contracts, foundational backend, shared frontend design system, repository structure, and integration boundaries.

Feature developers implement their assigned domains **inside these predefined boundaries**.

The goal is centralized architectural consistency with decentralized feature implementation.

---

# 2. Product Definition

> BloodLink is a hospital-centered blood coordination platform that connects hospitals with authorized blood centres and potential voluntary donors through hospital-verified blood requests, location-aware matching, tiered notifications, donor networks, and structured coordination.

BloodLink does **not** perform or replace:

- donor medical screening
- blood testing
- crossmatching
- blood collection
- blood processing
- blood storage
- blood issue
- transfusion
- medical eligibility determination

Those activities remain with authorized hospitals and blood centres.

---

# 3. System Architecture

BloodLink is an Internet-dependent multi-client platform.

```text
                         INTERNET
                            |
                            v
                 +----------------------+
                 |   BLOODLINK API      |
                 |       NestJS         |
                 |                      |
                 | PostgreSQL + PostGIS |
                 +----------+-----------+
                            |
                   +--------+--------+
                   |                 |
                   v                 v
             Mobile Client      Web Client
          React Native + Expo   Next.js + TS
```

Rules:

- Mobile never accesses the database directly.
- Web never accesses the database directly.
- All clients communicate through the API.
- Business rules live in the backend, not independently in clients.
- The backend is a modular monolith for the MVP.
- Microservices are explicitly out of scope.

---

# 4. Technology Foundation

## Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- PostGIS where geographic queries are required
- JWT authentication
- REST API

## Web

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Mobile

- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query
- React Hook Form
- Zod
- React Native Maps
- Expo Notifications

## Repository

Use a monorepo structure.

```text
bloodlink/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── contracts/
│   ├── validation/
│   ├── ui/
│   └── config/
├── prisma/
├── docs/
└── AGENTS.md
```

---

# 5. Ownership Model

## D1 — Lead / Platform Foundation

Owns:

- repository structure
- architecture
- authentication
- authorization / RBAC
- users
- organizations
- shared contracts
- shared validation conventions
- shared frontend design system
- application shells
- API client foundation
- infrastructure/configuration
- Prisma schema integration
- migrations integration
- CI/integration rules

D1 has final authority on cross-domain architectural decisions.

## D2 — Individual & Patient Need

Owns:

- Individual feature flows
- hospital discovery for individuals
- PatientNeed
- individual request/history UI
- PatientNeed API/service/tests

Does not own:

- BloodRequest lifecycle
- donor matching
- donor acceptance
- notifications
- communication
- blood-centre response handling

## D3 — Hospital & Blood Request

Owns:

- Hospital feature flows
- PatientNeed review UI
- BloodRequest
- BloodRequest lifecycle
- responder management
- donor selection
- standby management
- fulfillment coordination
- hospital request history

Does not own:

- candidate generation/matching algorithm
- notification transport
- donor profile management
- donor acceptance implementation
- generic messaging infrastructure

## D4 — Donor & Coordination

Owns:

- Donor feature flows
- Blood Centre feature flows
- DonorProfile
- matching
- DonorResponse
- OrganizationResponse
- notifications
- request-scoped communication
- donation confirmation/history
- HospitalSubscription

D4 owns how candidate responses are generated.
D3 owns what the hospital does with those responses.

---

# 6. Domain Boundary Principle

The core rule is:

> Feature developers own domain implementation. The Lead owns cross-domain architecture and integration.

A developer may create or modify implementation inside their feature directory without changing unrelated domains.

Cross-domain changes require Lead review.

---

# 7. Core Domain Entities

The foundation must establish the canonical model for:

```text
User
Organization
PatientNeed
BloodRequest
DonorProfile
DonorResponse
OrganizationResponse
HospitalSubscription
Conversation
Message
PushSubscription
```

Additional audit/security entities may be introduced by D1 when required by implementation.

---

# 8. PatientNeed

```text
PatientNeed
├── id
├── submittedByUserId
├── hospitalId
├── bloodGroup
├── component
├── units
├── urgency
├── requiredBy
├── additionalNotes
├── status
├── createdAt
└── updatedAt
```

Initial status:

```text
PENDING_HOSPITAL_REVIEW
```

`requiredBy` is an exact timestamp.

`additionalNotes` is required coordination context, not unrestricted medical-record storage.

Flow:

```text
Individual
  -> PatientNeed
  -> Hospital review
  -> BloodRequest
```

---

# 9. BloodRequest

```text
BloodRequest
├── id
├── hospitalId
├── patientNeedId
├── bloodGroup
├── component
├── unitsRequired
├── urgency
├── status
├── requiredBy
└── createdAt
```

Lifecycle:

```text
OPEN
  -> RESPONSES_RECEIVED
  -> COVERED
  -> COORDINATING
  -> FULFILLMENT_PENDING
  -> FULFILLMENT_CONFIRMED
  -> FULFILLED
```

Failure/backup path:

```text
COORDINATING
  -> BACKUP_REQUIRED
  -> standby / expanded outreach / reopen coordination
```

A first donor acceptance does not automatically close the request.

---

# 10. Donor Response

Acceptance requires explicit confirmation.

```text
Donor sees request
  -> Accept Donation
  -> confirmation UI
  -> Confirm
  -> POST /blood-requests/:id/accept
  -> DonorResponse = ACCEPTED
```

Canceling the confirmation must not mutate acceptance state.

Acceptance is not equivalent to successful donation.

If multiple donors accept:

```text
Selected donor -> SELECTED
Other suitable donors -> STANDBY
```

---

# 11. Matching

MVP matching is deterministic; no ML is required.

Inputs:

- BloodRequest
- donor profiles
- hospital location

Candidate considerations:

- blood group
- availability
- notification preference
- donation-state constraints
- geographic distance

Physical distance is the fundamental ranking criterion.
District boundaries are not hard matching boundaries.

Medical eligibility is not determined by BloodLink.

---

# 12. Notifications

Operational notifications are core functionality.

Supported platforms:

```text
Mobile -> Expo Push Notifications
Web    -> Web Push / Service Worker
```

Canonical entity:

```text
PushSubscription
├── id
├── userId
├── platform
├── endpoint/token
├── enabled
├── createdAt
├── updatedAt
└── lastUsedAt
```

A user may have multiple subscriptions/devices.

Notification payloads must be privacy-safe.
Do not include patient identity or unnecessary medical details in push payloads.

---

# 13. Communication

No generic social chat.

Communication is request-scoped.

```text
Conversation
├── id
├── bloodRequestId
├── organizationId
├── donorId
├── status
└── createdAt

Message
├── id
├── conversationId
├── senderId
├── content
├── createdAt
└── readAt
```

REST messaging is sufficient for the MVP. WebSockets are not required for the foundation sprint.

---

# 14. API Rules

REST over HTTPS.

Authenticated requests use:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

Use conventional HTTP status codes:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
500 Internal Server Error
```

Do not expose internal stack traces.

All API responses must follow one canonical response/error convention established by D1.

---

# 15. API Contract Ownership

The Lead establishes the API conventions and canonical cross-domain contracts.

Feature developers implement endpoint behavior within those contracts.

Every endpoint specification should identify:

```text
Method
Path
Owner
Authorization
Input DTO
Output DTO
State changes
Errors
Dependencies
Privacy constraints
```

Example scaffold:

```ts
/**
 * POST /blood-requests
 *
 * OWNER: D3
 *
 * PURPOSE:
 * Create an official BloodRequest from a verified PatientNeed.
 *
 * INPUT:
 * CreateBloodRequestDto
 *
 * OUTPUT:
 * BloodRequestResponse
 *
 * AUTHORIZATION:
 * Hospital users only.
 *
 * MUST NOT:
 * - perform donor matching
 * - send push notifications directly
 * - manage donor acceptance
 *
 * DEPENDENCY:
 * Verified PatientNeed
 */
```

The agent should create these implementation boundaries without inventing additional responsibilities.

---

# 16. Authentication & Authorization

The Lead owns the complete authentication foundation.

Required roles:

```text
INDIVIDUAL
HOSPITAL
BLOOD_CENTRE
ADMIN
```

Organization users resolve to an organization context.

Authorization must be enforced server-side.
Frontend route protection is UX protection, not the security boundary.

---

# 17. Frontend Design System

The Lead owns the centralized visual language.

Required shared primitives include:

```text
Button
Input
Select
Textarea
FormField
Card
Modal
Badge
Tabs
Dropdown
Toast
LoadingState
ErrorState
EmptyState
```

Centralized tokens:

```text
colors
 typography
 spacing
 border radius
 shadows
 breakpoints
 icon conventions
```

Feature developers must compose these components rather than create competing global components.

Feature-specific components are allowed when genuinely domain-specific.

---

# 18. Plug-and-Play Styling Rule

Feature screens must consume design tokens and shared UI primitives.

Example:

```tsx
<Button variant="primary">Submit Request</Button>
```

Do not hard-code project-wide colors, typography, spacing, or button styles repeatedly inside feature screens.

The Lead must be able to modify the global visual system without manually rewriting every feature screen.

---

# 19. Web Architecture

```text
apps/web/src/
├── app/
├── components/
├── features/
│   ├── individual/
│   ├── hospital/
│   ├── donor/
│   └── blood-centre/
├── lib/
└── api/
```

Web is role-aware and may be used by individuals, donors, hospitals, blood centres, and administrators according to authorization.

Web is optimized for organization dashboards and large information surfaces, but role capability is not artificially restricted to organizations.

---

# 20. Mobile Architecture

```text
apps/mobile/src/
├── app/
├── components/
├── features/
│   ├── individual/
│   ├── hospital/
│   ├── donor/
│   └── blood-centre/
├── lib/
└── api/
```

Mobile is optimized for quick individual/donor workflows and location/notification interactions while remaining role-capable.

---

# 21. Location & Privacy

Precise donor location is internal matching data.

Ordinary users must not receive:

- exact donor coordinates
- home address
- another donor's location
- unauthorized contact information

Hospital-facing UX may expose approximate distance, such as:

```text
~4 km away
```

Do not expose exact coordinates through ordinary API responses.

---

# 22. Shared File Ownership

D1 owns:

```text
AGENTS.md
packages/ui/
packages/contracts/
packages/validation/
packages/config/
root configuration
application shells
shared API client foundation
prisma/schema.prisma integration
prisma/migrations integration
```

D2 owns:

```text
apps/api/src/patient-needs/
apps/web/src/features/individual/
apps/mobile/src/features/individual/
```

D3 owns:

```text
apps/api/src/blood-requests/
apps/web/src/features/hospital/
apps/mobile/src/features/hospital/
```

D4 owns:

```text
apps/api/src/matching/
apps/api/src/responses/
apps/api/src/notifications/
apps/api/src/communication/
apps/api/src/donations/
apps/web/src/features/donor/
apps/web/src/features/blood-centre/
apps/mobile/src/features/donor/
apps/mobile/src/features/blood-centre/
```

Feature developers must not modify another developer's owned feature implementation without coordination.

---

# 23. Prisma / Migration Rule

The canonical Prisma schema is a shared integration surface.

D2/D3/D4 may design and propose their domain models and fields.

D1 integrates the final schema and migrations to avoid concurrent migration conflicts.

Do not create competing migration histories from multiple branches.

---

# 24. Shared File Change Rule

The following require Lead approval:

- shared UI components
- design tokens
- API contracts
- global types/enums
- authentication
- authorization
- database architecture
- Prisma integration
- root configuration
- package dependencies
- application shell
- cross-domain interfaces

Feature-local changes do not require architectural approval when they remain within the defined contract.

---

# 25. Git Rules

Use feature branches from the current stable `main`.

Recommended names:

```text
feat/d2-patient-needs
feat/d3-blood-requests
feat/d4-matching
feat/d1-foundation
```

Rules:

1. Keep commits focused.
2. Do not mix unrelated refactors into feature PRs.
3. Rebase/update from latest `main` before merge when necessary.
4. Run validation before PR.
5. Shared-file changes require Lead review.
6. Merge completed work into `main` only after validation.

---

# 26. Agent Operating Rules

The coding agent must:

1. Read this specification before modifying the repository.
2. Read `AGENTS.md` before implementation.
3. Treat this specification as authoritative.
4. Preserve the existing architecture unless explicitly instructed otherwise.
5. Never invent a new domain entity without approval.
6. Never redesign an API contract without approval.
7. Never duplicate shared UI primitives.
8. Never modify unrelated feature ownership areas.
9. Avoid unnecessary dependencies.
10. Run formatting, linting, typechecking, and relevant tests after changes.
11. Report assumptions before making consequential architectural changes.
12. Prefer small, reversible changes.
13. Do not implement feature business logic during the foundation-scaffolding stage unless explicitly requested.

---

# 27. Foundation Sprint Deliverables

At the end of the Lead Foundation Sprint, the repository should contain:

- monorepo structure
- backend application shell
- web application shell
- mobile application shell
- database configuration
- canonical Prisma schema foundation
- authentication foundation
- RBAC foundation
- API conventions
- shared contracts
- validation foundation
- shared frontend design system
- shared UI primitives
- API client foundation
- feature directory scaffolds
- endpoint/interface comments for feature developers
- AGENTS.md
- developer ownership documentation
- validation commands

Feature business logic is not required for completion of this foundation stage.

---

# 28. Definition of Done

The foundation is complete when:

- all three applications start successfully
- the API connects to the database
- authentication foundation compiles and has basic validation
- RBAC structure exists
- shared packages resolve correctly
- design-system components render
- feature directories exist with clear ownership
- endpoint contracts are documented
- TypeScript typechecking passes
- linting passes or known baseline exceptions are documented
- no duplicate global UI primitives exist
- no unresolved architectural TODOs remain in the foundation
- D2/D3/D4 can clone/update the repository and immediately begin feature implementation

---

# 29. Final Authority Rule

The Lead has final authority over **cross-domain architecture and integration**.

This authority exists to maintain consistency, not to micromanage feature implementation.

The intended operating model is:

```text
LEAD
  |
  | architecture + contracts + foundation
  v
STABLE PLATFORM CORE
  |
  +------ D2: Individual / PatientNeed
  |
  +------ D3: Hospital / BloodRequest
  |
  +------ D4: Donor / Coordination
```

The Lead builds the rails.
Feature developers build the features on those rails.
