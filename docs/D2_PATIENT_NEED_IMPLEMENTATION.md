# D2 Individual and PatientNeed Implementation Scaffold

## Ownership

D2 owns individual hospital discovery and selection, PatientNeed creation,
retrieval, history, and owner-requested cancellation.

D2 does not own BloodRequest creation or lifecycle, hospital verification,
donor matching or selection, responses, notifications, communication, inventory,
medical eligibility, screening, collection, testing, storage, or transfusion.

## PatientNeed model

`PatientNeed` links the authenticated submitting `User` to a hospital
`Organization`. It stores blood group, component, units, coordination urgency,
the exact `requiredBy` timestamp, required coordination notes, lifecycle status,
and timestamps. The initial status is `PENDING_HOSPITAL_REVIEW`.

The model intentionally contains no medical-record, BloodRequest, donor,
matching, or notification fields. `additionalNotes` is coordination context,
not unrestricted medical-record storage. Blood group, component, and urgency
are caller-selected coordination inputs; BloodLink does not determine
component suitability or perform medical triage.

## Lifecycle boundary

```text
PENDING_HOSPITAL_REVIEW
  ├── VERIFIED  (hospital-owned; D2 must not implement)
  ├── REJECTED  (hospital-owned; D2 must not implement)
  └── CANCELLED (owner may request; D2 implements only this transition)
```

D2 cancellation must verify authenticated ownership and allow the transition
only from `PENDING_HOSPITAL_REVIEW`. Verification and rejection remain with the
hospital-owned workflow. No transition creates a BloodRequest.

## PatientNeed endpoints

All paths are under `/api/v1` and use the shared `{ data }` success envelope
and canonical API error envelope.

| Method and path | Purpose | Authorization |
| --- | --- | --- |
| `POST /patient-needs` | Create a PatientNeed | Authenticated INDIVIDUAL; server sets `submittedByUserId` and initial status |
| `GET /patient-needs` | List the caller's needs/history | Authenticated INDIVIDUAL; query by authenticated owner only |
| `GET /patient-needs/:id` | Retrieve an owned need | Authenticated INDIVIDUAL; enforce owner in the database query |
| `POST /patient-needs/:id/cancel` | Request cancellation | Authenticated INDIVIDUAL; enforce owner and pending status |

Create input is `CreatePatientNeedRequest`. It excludes owner, status, and
timestamps. The matching Zod schema is `CreatePatientNeedSchema` in the shared
validation package. Resource IDs and API timestamps use strings, consistent
with the shared contracts.

## Hospital discovery

`GET /api/v1/hospitals` accepts the current latitude and longitude as transient
search input, plus optional `radiusMeters` and `query`. The values must not be
stored on `User` or copied into a PatientNeed. Future implementation should use
PostGIS geographic distance, not district boundaries, as the distance
criterion.

Hospital coordinates are persistent `Organization.latitude` and
`Organization.longitude` values stored as PostgreSQL `DECIMAL(9,6)` and checked
for valid coordinate ranges. Coordinates must be paired; the migration requires
them for HOSPITAL organizations. Future discovery responses should use only the
shared `HospitalSummary` fields needed for selection, and must not expose staff,
membership, credentials, or internal organization metadata. Do not expose raw
PostGIS geometry.

## Shared packages and clients

`packages/contracts` owns PatientNeed request/response and hospital discovery
types. `packages/validation` owns the corresponding Zod schemas. API, web, and
mobile should consume those shared definitions rather than creating local
domain models.

The web and mobile D2 directories contain placeholders only. They should call
the API through the established shared API-client foundation when it is
available, and use the shared UI/design system rather than creating global UI
primitives. They must not access PostgreSQL directly.

## Recommended D2 implementation order

1. Prisma migration/model
2. Shared contracts
3. Shared validation
4. Repository/service
5. Authorization
6. PatientNeed controller
7. Hospital discovery
8. Web implementation
9. Mobile implementation
10. Tests
11. Integration verification

## D3 integration boundary

D3 owns hospital review and the BloodRequest workflow. D2 may create a
PatientNeed in `PENDING_HOSPITAL_REVIEW` and request its cancellation while
pending. D2 does not verify/reject a need, create a BloodRequest, or implement
hospital review queues. D3 should consume the shared PatientNeed model and
status without changing D2 ownership or exposing another individual's private
record through individual endpoints.
