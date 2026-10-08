# D3 Hospital and BloodRequest Implementation Scaffold

This document defines the D3 implementation boundary. All API paths use the existing `/api/v1` prefix and shared success/error envelopes.

## 1. D3 ownership

D3 owns hospital review of PatientNeeds, verification and rejection, BloodRequest creation during verification, BloodRequest lifecycle, hospital-side responder coordination, responder selection/standby/release/promotion, fulfillment coordination and confirmation, hospital request history, and hospital-facing BloodRequest UI.

## 2. D3 non-responsibilities

D3 does not create or cancel individual PatientNeeds; create donor or organization responses; implement donor or blood-centre matching; implement donor profiles, notifications, communication, donation eligibility, medical screening, inventory, collection, testing, storage, issue, or transfusion. D4 owns responder and response generation. D2 owns the individual-side PatientNeed workflow.

## 3. PatientNeed to hospital review

D2 creates a PatientNeed in `PENDING_HOSPITAL_REVIEW`. D3 presents the need to members of its hospital and may verify or reject it. An individual cannot create a BloodRequest directly. Verification is the only origin for a BloodRequest.

## 4. PatientNeed lifecycle ownership

```text
PENDING_HOSPITAL_REVIEW
  ├── VERIFIED  (D3)
  ├── REJECTED  (D3)
  └── CANCELLED (D2 owner-requested cancellation)
```

D3 implements only the two hospital transitions. It must not change D2's cancellation behavior. Cancelled needs cannot be verified or rejected; verified needs cannot be rejected or cancelled; rejected needs cannot be verified or cancelled. Re-review is not introduced here.

## 5. BloodRequest model

`BloodRequest` belongs to one hospital Organization and one PatientNeed. It copies the coordination fields `bloodGroup`, `component`, `unitsRequired`, `urgency`, and `requiredBy`; it adds lifecycle status and timestamps. The unique constraint on `patientNeedId` allows at most one BloodRequest per PatientNeed. No medical-record, inventory, donor, matching, notification, or transfusion fields are present.

## 6. BloodRequest lifecycle

Normal lifecycle:

```text
OPEN -> RESPONSES_RECEIVED -> COVERED -> COORDINATING
     -> FULFILLMENT_PENDING -> FULFILLMENT_CONFIRMED -> FULFILLED
```

Recovery path:

```text
COORDINATING -> BACKUP_REQUIRED
              -> additional outreach / standby promotion
              -> RESPONSES_RECEIVED or COORDINATING as appropriate
```

`COVERED` means responder coverage is sufficient; it does not mean fulfillment has occurred. No other lifecycle states are introduced.

## 7. Cancellation rules

Hospital cancellation is allowed only from `OPEN`, `RESPONSES_RECEIVED`, `COVERED`, `COORDINATING`, or `BACKUP_REQUIRED`. It is forbidden from `FULFILLMENT_PENDING`, `FULFILLMENT_CONFIRMED`, and `FULFILLED`. The scaffold does not implement transition checks.

## 8. ResponderAssignment model

`ResponderAssignment` records the hospital's decision and belongs to one BloodRequest. Its state is `SELECTED`, `STANDBY`, or `RELEASED`; it records assignment, release, and creation/update timestamps. Assignment state is separate from response lifecycle.

## 9. Option B: response and assignment are separate

```text
DonorResponse / OrganizationResponse (D4-owned response fact)
                         |
                         v
ResponderAssignment (D3-owned hospital coordination decision)
```

"Donor accepted" does not mean "hospital selected donor." D4 owns the response; D3 owns selection, standby, and release. D3 must not mutate a D4 response to represent a hospital decision.

## 10. D3/D4 boundary

D4 response models do not exist yet. `ResponderAssignment` contains nullable UUID reference columns `donorResponseId` and `organizationResponseId`, plus a database XOR check requiring exactly one to be set. These are deferred references, not foreign keys, until D4 models are integrated. No D4 model or response lifecycle is created here. Shared boundary contracts identify a response by ID and response type without defining D4 response content.

D3 may read D4 responses and coordinate them after integration. D3 must not generate responses, match candidates, send notifications, or implement D4 response state.

## 11. Hospital authorization

All routes require JWT authentication and either `HOSPITAL_ADMIN` or `HOSPITAL_STAFF`. Existing role checks require an active hospital membership. The exact locked routes do not carry an `organizationId` path parameter, so the existing organization membership guard cannot resolve a target organization at the route layer. D3 repository queries must therefore join the target PatientNeed/BloodRequest to its hospital and verify the authenticated user's active membership in that same organization. List queries must be restricted to the user's active hospital memberships. Never trust a client-supplied `hospitalId`; no D3 write input accepts one.

## 12. API endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /hospital/patient-needs` | List review/history for the authenticated user's hospital memberships |
| `GET /hospital/patient-needs/:id` | Read a PatientNeed only within an authorized hospital |
| `POST /hospital/patient-needs/:id/verify` | Verify and create the official BloodRequest |
| `POST /hospital/patient-needs/:id/reject` | Reject a pending PatientNeed |
| `GET /blood-requests` | List BloodRequests in authorized hospital organizations |
| `GET /blood-requests/:id` | Retrieve an authorized BloodRequest and coordination details |
| `POST /blood-requests/:id/cancel` | Cancel before fulfillment starts |
| `GET /blood-requests/:id/responses` | Read response references across the D4 boundary |
| `POST /blood-requests/:id/responders/:responseId/select` | Select a responder or promote standby |
| `POST /blood-requests/:id/responders/:responseId/standby` | Set hospital assignment to standby |
| `POST /blood-requests/:id/responders/:responseId/release` | Release a hospital assignment |
| `POST /blood-requests/:id/fulfillment/start` | Start fulfillment coordination |
| `POST /blood-requests/:id/fulfillment/confirm` | Confirm fulfillment through the authorized real-world process |

There is intentionally no `POST /blood-requests` endpoint. Verification creates the request. All endpoint handlers currently return 501 until D3 implements them.

## 13. Contracts

`packages/contracts` defines hospital PatientNeed review/list/action responses, BloodRequest record/list/detail/action responses, assignment views, fulfillment responses, and a narrow `ResponderResponseReference` integration type. It reuses D2 PatientNeed and primitive types. It does not define D4 response entities or a public BloodRequest create request.

## 14. Validation

`packages/validation` defines hospital PatientNeed query and BloodRequest list query schemas, empty cancellation/fulfillment action schemas, and structural selection/standby/release schemas that identify the response type. Validation does not implement medical eligibility, compatibility, donor eligibility, inventory, or triage rules.

## 15. Database model

The Prisma schema adds `BloodRequestStatus`, `ResponderAssignmentState`, `BloodRequest`, and `ResponderAssignment`. BloodRequest uses a unique `patientNeedId`, indexed hospital/status fields, and restrictive relations to Organization and PatientNeed. ResponderAssignment cascades with BloodRequest, has an index by request/state, and enforces the one-response-type XOR invariant. Deferred D4 IDs have no foreign keys until D4 integration.

## 16. Transaction boundaries

PatientNeed verification plus BloodRequest creation must eventually run in one database transaction. It must not leave a verified PatientNeed without its BloodRequest or a pending PatientNeed with a created request. The transaction is TODO(D3), not implemented in this scaffold.

Responder assignment updates and corresponding BloodRequest coordination state must eventually remain consistent. D3 must validate the response belongs to the same BloodRequest and must change only D3 assignment state, not D4 response state.

## 17. Testing requirements

`apps/api/test/blood-requests.spec.cjs` records pending test cases for review ownership, valid/invalid PatientNeed transitions, exactly-once transactional request creation, no individual creation endpoint, lifecycle/cancellation, assignment ownership and D4 state isolation, and fulfillment transitions. They are explicit TODO tests, not fake passing assertions.

## 18. Web structure

```text
apps/web/src/features/hospital/
  patient-needs/{api.ts,hooks.ts,components/}
  blood-requests/{api.ts,hooks.ts,components/}
  responder-coordination/{api.ts,hooks.ts,components/}
```

Placeholders use shared contracts. D3 should use the shared UI/design system and must not create global UI primitives or bypass the API.

## 19. Mobile structure

```text
apps/mobile/src/features/hospital/
  patient-needs/{api.ts,hooks.ts}
  blood-requests/{api.ts,hooks.ts}
  responder-coordination/{api.ts,hooks.ts}
```

These files are TODO-only. They use shared workspace contracts and do not introduce another API client or local domain model.

## 20. Recommended implementation order

1. Prisma migration/model
2. Shared contracts
3. Shared validation
4. Hospital PatientNeed review
5. PatientNeed verification/rejection
6. Transactional BloodRequest creation
7. BloodRequest lifecycle
8. Responder coordination integration boundary
9. Fulfillment
10. Web
11. Mobile
12. Tests
13. Integration verification

## 21. Integration requirements

Apply the D3 migration only after the Lead reviews the D2 migration and the D4 response integration boundary. D4 must later add the response models and reviewed foreign keys without changing Option B assignment ownership. Verify that the response XOR constraint remains valid after those foreign keys are added. Keep routes, shared response envelopes, status enums, and IDs consistent with D1/D2 contracts.

## 22. Explicit D2 boundary

D2 remains the owner of individual PatientNeed creation, retrieval, history, and cancellation. D3 consumes the existing PatientNeed model and adds only the hospital-side review surface. D3 must not move, rewrite, duplicate, or alter D2 files or behavior. D2 cancellation remains an owner-requested transition from `PENDING_HOSPITAL_REVIEW` to `CANCELLED`.
