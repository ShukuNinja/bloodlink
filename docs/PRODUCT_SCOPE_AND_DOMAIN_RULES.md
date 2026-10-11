# Product Scope and Domain Rules

## 1. Product goal

BloodLink connects individuals with hospitals and blood banks through consent-based, request-scoped coordination. The current delivery target is a working **web client plus backend**. The mobile application is not part of this delivery.

## 2. Actors

- **Individual user:** discovers hospitals, submits a PatientNeed handoff, and may volunteer for any open BloodRequest.
- **Hospital organization:** reviews PatientNeed submissions, verifies or rejects them, and creates/manages official BloodRequests.
- **Blood bank organization:** participates in supported organization response/coordination flows.
- **Volunteer/donor:** a capability of an Individual account, not a separate role or profile registration. The Individual accepts or withdraws a request; the Hospital reviews suitability, selects responders, and maintains its operational donor list.
- **Administrator:** administrative capabilities only where the current implementation explicitly supports them.

An individual’s PatientNeed is not an official BloodRequest. The hospital is responsible for the official review and request-creation step.

## 3. In-scope web journeys

1. Authentication and session handling.
2. Hospital discovery and hospital details where supported.
3. Subscribe/unsubscribe to individual hospitals from the hospital list.
4. Individual creates and tracks PatientNeed submissions, including history and cancellation where supported.
5. Hospital reviews a PatientNeed, verifies or rejects it, and creates the official BloodRequest.
6. Hospital manages the official BloodRequest lifecycle and responder assignments within the approved contract.
7. Individual request responses, organization responses, optional hospital subscriptions, in-app alerts, and request-scoped communication only where supported by the current API contract.
8. Error, loading, empty, success, and permission-denied states across these journeys.

## 4. Explicit exclusions

- No blood inventory/availability management or inventory APIs.
- No integration with e-RaktKosh as part of this scope.
- No individual-to-individual blood request flow.
- No individual-to-individual chat.
- No broad, unscoped social or messaging system.
- No mobile application work in this delivery.
- Do not put medical screening logic into BloodLink business logic.
- Do not expose a donor’s precise location in ordinary user-facing responses.
- Do not let the D2 PatientNeed module write official BloodRequest, ResponderAssignment, DonorResponse, or OrganizationResponse state.

## 5. Domain entities and lifecycle boundaries

### PatientNeed

A submission from an individual asking a hospital to review a need. It is a handoff/work queue item, not an official blood request. The individual can view their own records and cancel where the backend allows it. Hospital review is owned by the hospital workflow.

### BloodRequest

The official request created after hospital review. D3 owns its lifecycle and responder-assignment state. D2 must not create or mutate it.

### Hospital subscription

An individual user’s opt-in relationship with a hospital, intended to let the user follow blood requests posted by that hospital. Subscription is distinct from responding to a particular request and does not itself accept a donation, reserve a donor, or create a request.

- Subscribe: `POST /api/v1/hospitals/:id/subscription`
- Unsubscribe: `DELETE /api/v1/hospitals/:id/subscription`

Verify the actual route registration and response shape in the current checkout before treating this as a frozen contract. The UI must reflect the server-confirmed state, not merely a click.

### Consent and two-way acceptance

Communication and coordination must remain consent-based. Where a workflow requires two-way acceptance, do not treat one party’s action as sufficient confirmation. Subscription to a hospital is not equivalent to consent for a request-specific conversation or donation.

## 6. Location and discovery

- Canonical organization location is PostgreSQL PostGIS `GEOGRAPHY(POINT,4326)` with GiST indexes. Individual donor location is not required or collected.
- Do not add duplicate persistent latitude/longitude columns or substitute Haversine calculations.
- Hospital discovery should return eligible active HOSPITAL organizations with valid canonical locations.
- The approved default discovery radius is 25,000 metres.
- The previously agreed discovery API requires caller coordinates with optional `radiusMeters`; browsing without coordinates is a contract question to resolve rather than silently inventing behavior.
- Never display precise donor location in ordinary user-facing views.

## 7. Response conventions

- Success envelope: `{ "data": ... }`
- Error envelope: `{ "error": ... }`

Check actual implementation details and shared contracts before changing these conventions.
