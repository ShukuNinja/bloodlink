# D4 Donor and Coordination Implementation Scaffold

## 1. Ownership

D4 owns donor profiles and coordination preferences, deterministic matching,
spatial candidate discovery, donor and blood-centre responses, hospital
subscriptions, push subscriptions and notification delivery, request-scoped
communication, and authorized donation confirmation/history.

## 2. Non-responsibilities

D4 does not create/cancel/verify PatientNeeds, create or change BloodRequests,
mutate BloodRequest lifecycle or D3 ResponderAssignments, make hospital
operational decisions, determine medical eligibility, screen donors, or manage
inventory, collection, testing, storage, issue, or transfusion.

**D4 produces responses. D3 coordinates responses.**

## 3. DonorProfile

`DonorProfile` is one-to-one with `User` and contains blood group, availability
(`AVAILABLE`, `UNAVAILABLE`), notification preference (`ALL`, `URGENT_ONLY`,
`CRITICAL_ONLY`, `NONE`), coordination status (`ACTIVE`, `PAUSED`), optional
PostGIS location, `lastConfirmedDonationAt`, and `eligibleFrom`. These are
coordination/application values, not medical determinations. No universal
cooldown is calculated. Public profile contracts omit precise coordinates;
location inputs are transient API values which are persisted only as the
canonical geography point.

## 4. Responses

`DonorResponse` and `OrganizationResponse` refer to an existing D3
`BloodRequest`; organization responders must be `BLOOD_CENTRE` organizations.
Both use the same `CoordinationResponseStatus`: `NOTIFIED`, `ACCEPTED`,
`WITHDRAWN`, `EXPIRED`. A unique request/responder pair prevents duplicate
response rows. Acceptance requires explicit confirmation; canceling the
confirmation has no mutation. `ACCEPTED` does not mean `DONATED` and does not
create a `DonationRecord`.

## 5. HospitalSubscription and push subscriptions

`HospitalSubscription` is the donor's voluntary participation in one hospital's
request network, unique per hospital/donor pair, with `ACTIVE` or `PAUSED`
status. It is separate from `PushSubscription`, which represents one web or
Expo device/browser endpoint. A user may have multiple push subscriptions.
Notification payloads must remain privacy-safe and must not contain patient
identity or unnecessary medical details.

## 6. Matching and PostGIS

Matching is deterministic, not ML. Candidate discovery follows:

```text
BloodRequest → hospital geography → PostGIS candidate radius query
             → availability/coordination/preference filters
             → distance/rule ranking → notification tiers
```

Persistent spatial values use `GEOGRAPHY(POINT,4326)`. `Organization.location`
is canonical for hospital coordinates. The D4 migration copies existing D2
latitude/longitude values into geography, creates a GiST index, and drops the
old coordinate columns. Donor location also uses geography and a GiST index.
Runtime search must use `ST_DWithin()` for radius filtering and `ST_Distance()`
for distance/ranking. Do not use Haversine or load every donor into application
memory. The D2 HospitalSummary may continue returning hospital latitude and
longitude derived from the canonical geography value; they are not persisted
separately.

Matching tiers are nearest suitable donors, the hospital subscriber network,
then expanding geographic radius. Matching identifies candidate tiers;
`NotificationService` owns delivery and must not be tightly coupled to Expo or
Web Push. No medical eligibility decision is part of matching.

## 7. Privacy

Precise donor location is internal matching data. Ordinary API and notification
contracts must not expose donor latitude, longitude, address, or raw geometry.
If distance is returned, it is an approximate derived value such as
`approximateDistanceKm`. Hospital location remains canonical spatial data and
may be used by D2 discovery; it is not a second source of truth.

## 8. Communication

`Conversation` is tied to one `BloodRequest`; its hospital is derived through
that request. It has exactly one responder participant: `donorId XOR
organizationId`, enforced by a database check. This represents hospital ↔ one
responder communication only. It is never donor-to-donor, donor-to-blood-centre,
or a three-way conversation. `Message.senderId` is an authenticated user. REST
is sufficient; no generic chat or WebSocket infrastructure is introduced.
Access must verify participation in the request workflow server-side.

## 9. Donation confirmation boundary

`DonationRecord` records an authorized confirmation event with donor, request,
confirming user, and timestamps only. It has no screening, testing,
crossmatching, or transfusion data. There is no public/self-service endpoint to
create one. Only an authorized workflow may create a record and update the
profile's current/latest coordination fields. Acceptance alone changes neither
donation history nor eligibility coordination dates.

## 10. D3/D4 boundary

D4 reads the BloodRequest fields needed for matching and creates response
records only. D4 must never change `BloodRequest.status`, `unitsRequired`,
`hospitalId`, or `ResponderAssignment`. D3 continues owning responder selection,
standby/release, promotion, and fulfillment coordination. The migration adds
foreign keys from D3's deferred response IDs to D4 response tables without
changing D3 ownership or assignment state.

## 11. Authorization

- Donor routes require an authenticated individual and, where required, the
  caller's active DonorProfile. User IDs and ownership come from the JWT.
- Blood-centre routes require an authenticated user with ACTIVE membership in
  an active `BLOOD_CENTRE` organization and an appropriate blood-centre role.
- Hospital subscriptions must verify the requested hospital and donor
  relationship server-side; route IDs alone grant no access.
- Conversation/message access must verify an authorized donor or organization
  participant through the related BloodRequest workflow.
- D4 never authorizes from client-supplied ownership or mutates D3 state.

Existing JWT/RBAC guards are retained. The API controller is a guarded 501
scaffold; the service throws `NotImplementedException` rather than returning
fake success objects.

Backend ownership boundaries are represented by `donor-profile`, `matching`,
`responses`, `hospital-subscriptions`, `notifications`, `communication`, and
`donations` service placeholders. The D4 module registers those boundaries;
they contain no repository queries or domain behavior.

## 12. API routes

All use `/api/v1` and existing response/error envelopes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/donor-profile` | Read own donor profile |
| PATCH | `/donor-profile` | Update own coordination profile |
| GET | `/donor/blood-requests` | List offered requests |
| GET | `/donor/blood-requests/:id` | Read an offered request |
| POST | `/blood-requests/:id/accept` | Confirm donor response |
| POST | `/blood-requests/:id/withdraw` | Withdraw donor response |
| GET | `/blood-centre/blood-requests` | List blood-centre requests |
| GET | `/blood-centre/blood-requests/:id` | Read an offered request |
| POST | `/blood-requests/:id/organization-response` | Create organization response |
| POST | `/hospitals/:id/subscription` | Join hospital request network |
| DELETE | `/hospitals/:id/subscription` | Leave hospital request network |
| GET | `/hospital-subscriptions` | List own network subscriptions |
| GET | `/blood-requests/:id/conversation` | Read authorized conversation |
| POST | `/blood-requests/:id/messages` | Create request-scoped message |

No donation-confirmation route is exposed.

## 13. Shared contracts and validation

`packages/contracts` contains public profile, donor request, response,
subscription, matching boundary, notification boundary, conversation, message,
and approximate-distance shapes. Public donor profile contracts omit
coordinates. `packages/validation` contains structural profile, donor query,
accept/withdraw, organization response, subscription, message, and push
subscription input schemas. Service-level authorization and domain rules remain
server-side; Zod does not encode medical or matching decisions.

## 14. Database and migration

The D4 migration adds `DonorProfile`, `DonorResponse`, `OrganizationResponse`,
`HospitalSubscription`, `PushSubscription`, `Conversation`, `Message`, and
`DonationRecord`, plus the D4 coordination enums. It uses foreign keys,
responder uniqueness, subscription uniqueness, timestamps and query indexes.
Conversation has a database XOR check. The migration also converts D2 hospital
coordinates to canonical geography and adds spatial GiST indexes, then drops
the old coordinate columns. It adds foreign keys for D3 deferred response IDs.
The migration is intentionally not applied as part of this scaffold.

## 15. Tests

`apps/api/test/d4.spec.cjs` records explicit `it.todo` cases for profile owner
isolation/privacy, confirmed response semantics, uniqueness, matching filters
and tiers, PostGIS, subscriptions, safe notification payloads, communication
authorization, donation-history boundaries, and the D3/D4 ownership boundary.
These are pending tests, not passing assertions.

## 16. Web and mobile structure

Both clients use shared contracts and existing API-client/design-system
foundations. Feature placeholders are arranged under donor profile, donor
blood requests, donor responses, subscriptions, blood-centre requests and
responses, request communication, notifications, and matching. They contain
type boundaries only; no screens, duplicate UI primitives, API bypass, or
business behavior is added.

## 17. Recommended implementation order

1. Prisma migration/model
2. Shared contracts
3. Shared validation
4. DonorProfile
5. DonorResponse and OrganizationResponse
6. PostGIS matching and tier boundaries
7. Hospital subscriptions
8. Push subscriptions and notification delivery
9. Request-scoped communication
10. Authorized donation confirmation/history
11. Web
12. Mobile
13. Tests
14. Integration verification

## 18. Integration requirements

Apply the migration only after Lead review. Verify preserved hospital geography
against existing coordinates before deployment. Confirm D2 discovery derives
its existing HospitalSummary coordinates from `Organization.location`. Confirm
D3 assignment foreign keys and XOR constraint coexist. Test every D4 operation
against active membership/profile ownership, and verify D4 writes cannot alter
D3 BloodRequest or ResponderAssignment fields.
