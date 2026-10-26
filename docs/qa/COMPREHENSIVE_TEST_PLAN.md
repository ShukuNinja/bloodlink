# BloodLink Comprehensive QA Test Plan

Updated: 2026-10-26

## Application and environment

- Repository: BloodLink monorepo; branch `main`; candidate commit `15baaf3`.
- Working tree was already dirty before QA. Existing changes are preserved and
  are outside this QA artifact set.
- `docs/LEAD_FOUNDATION_SPEC.md` referenced by root `AGENTS.md` is absent.
- No local web/API/database/mobile service listeners were found during
  reconnaissance. `apps/api/.env` exists; its values were not read or recorded.
- Supabase is user-managed and out of scope for writes. No Supabase activity was
  performed.
- Available scripts: root/API/web/mobile lint, typecheck, test; API tests build
  then run Node test suites; web/mobile builds; mobile build uses Expo export.
- Actual UI and authenticated journey testing requires a started app, safe test
  accounts, and isolated disposable database fixtures.

## Supported roles and authorization model

- `INDIVIDUAL`: donor and patient-need submitter capabilities.
- `ADMIN`: platform administration pages and endpoints; not an authorization
  bypass for organization-scoped workflows.
- `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`: organization memberships for hospital
  workflows.
- `BLOOD_CENTRE_ADMIN`, `BLOOD_CENTRE_STAFF`: organization memberships for
  blood-centre workflows.
- Organization type is `HOSPITAL` or `BLOOD_CENTRE`; platform accounts use
  `INDIVIDUAL` or `ADMIN`. Memberships are checked server-side.

## Discovered feature inventory

| ID  | Feature / entry points                                                                             | Roles                               | Expected behavior / test method                                                                                       | Status                                                  |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| F01 | Authentication: `/auth`; API register/login/refresh/logout/me                                      | All                                 | Validate registration/login, session rotation, logout, identity and failure handling; UI + API tests                  | PARTIAL: API tests; UI not run                          |
| F02 | Role-aware routing/navigation: web app shell and mobile Expo routes                                | All                                 | Correct landing and route guards; direct URL and mobile navigation checks                                             | PARTIAL: routing unit tests; UI not run                 |
| F03 | Admin overview/accounts/organizations: `/admin`; `GET /admin/*`                                    | ADMIN                               | Read metrics and lists; verify non-admin denial and no privileged bypass                                              | PARTIAL: API/web tests; UI not run                      |
| F04 | Organization discovery: `/organizations`, `/hospitals`; `GET /organizations`, `/hospitals`         | Authenticated                       | Search/filter/sort/radius, empty/error/loading, location handling; web/mobile UI + API                                | PARTIAL: API tests; UI not run                          |
| F05 | Individual donor profile and preferences: `/donor`                                                 | INDIVIDUAL                          | Read/update profile and eligibility/preference behavior where implemented; UI + API                                   | NOT IMPLEMENTED: self-service profile/eligibility       |
| F06 | PatientNeed lifecycle: `/patient-needs`, create/detail; POST/GET/cancel API                        | INDIVIDUAL                          | Create, validate, list/detail, ownership and cancellation lifecycle                                                   | PARTIAL: API + isolated DB tests; UI not run            |
| F07 | Hospital PatientNeed review: `/hospital/patient-needs`; GET/verify/reject                          | Hospital members                    | Queue/detail, verification/rejection, membership and transition boundaries                                            | PARTIAL: API + isolated DB tests; UI not run            |
| F08 | BloodRequest lifecycle: `/hospital/blood-requests`; GET/detail/cancel                              | Hospital members                    | Request visibility, cancellation, pagination/filtering and state restrictions                                         | PARTIAL: API tests; UI not run                          |
| F09 | Responder coordination/fulfillment: request detail; select/standby/release/start/confirm endpoints | Hospital members                    | Cross-role responses, assignment, fulfillment and terminal locks                                                      | PARTIAL: API tests; UI not run                          |
| F10 | Individual donor request discovery/responses: `/donor`; list/detail/accept/withdraw                | INDIVIDUAL                          | Matching visibility, response persistence, duplicate/withdraw/terminal behavior; no precise donor location disclosure | PARTIAL: API tests; UI not run                          |
| F11 | Blood-centre request response: `/blood-centre`; list/detail/respond/withdraw                       | Blood-centre members                | Request discovery, organization response ownership, withdraw locks                                                    | PARTIAL: API tests; UI not run                          |
| F12 | Organization subscriptions: `/subscriptions`; POST/DELETE/list endpoints                           | Authenticated eligible users        | Subscribe/unsubscribe, duplicate behavior, ownership and persisted list                                               | PARTIAL: API tests; UI not run                          |
| F13 | Organization conversations and messaging: `/conversations`; list/create/detail/message endpoints   | Active organization members         | Pair idempotency, membership, message validation, cross-org access controls                                           | PARTIAL: API service tests; UI not run                  |
| F14 | PatientNeed/BloodRequest private conversation: conversation panels/routes and API                  | Submitter + target hospital members | Starts only for verified need/request; scoped access; terminal closure                                                | PARTIAL: API service tests; UI not run                  |
| F15 | Notifications: `/notifications`; API feed                                                          | Authenticated roles                 | Role/subscription filtering, empty/error/loading behavior; derived in-app alerts                                      | PARTIAL: API tests; UI not run                          |
| F16 | Mobile persistence/session handling: Expo auth, SecureStore, API client                            | All mobile roles                    | Login, refresh rotation, restart restore, logout, network/auth errors; device/emulator UI                             | PARTIAL: mobile unit tests; device UI not run           |
| F17 | API conventions/health: `/api/v1/health`, interceptors, validation and errors                      | Public health; authenticated APIs   | Health response, request IDs, envelope, validation and sanitized errors                                               | PARTIAL: API tests; deployed health not run             |
| F18 | Deployment and runtime configuration: deployment docs/config                                       | Operators                           | Verify health checks, environment requirements and deployment wiring by inspection; no deploy without authorization   | NOT RUN: no deployment target                           |
| F19 | Data access and security: all protected APIs                                                       | All                                 | Horizontal/vertical authorization, object ownership, location/privacy, token/session handling via safe local tests    | PARTIAL: API authorization/privacy tests; no UI testing |

### Current automated evidence overlay

The inventory above lists the discovered surface. The following areas have
partial automated regression evidence from this QA run; none has complete
user-facing validation:

- Partial automated evidence: F01–F04, F06–F17, F19.
- Not implemented in the current self-service surface: F05 donor profile,
  preferences and medical eligibility management. Donor request discovery and
  responses are covered by F10.
- Not run: F18 deployment/runtime verification. F01–F19 UI/device journeys are
  also not run.
- Automated evidence: API 152/152, web 29/29, mobile 14/14; API TypeScript
  build passed. Exact commands and limits are in the test log.

## Strategy and test data

1. Run existing isolated automated suites and record exact outcomes; inspect
   database test harnesses before executing them.
2. Inspect UI behavior only against local services and test accounts. Never
   create or alter real Supabase data.
3. Use only fixtures created by repository-owned disposable test harnesses or
   explicitly designated local QA accounts. Do not reuse personal accounts.
4. Verify persisted state through isolated test assertions or read-only checks.
5. Record unavailable checks as BLOCKED/NOT RUN with a concrete reason.
6. Do not modify application code, dependencies, lockfiles, schema, or
   migrations during this review.

## Planned workflows and coverage matrix

| Journey                                              | Individual | Hospital | Blood Centre | Admin | Web | Mobile     | Initial status                        |
| ---------------------------------------------------- | ---------- | -------- | ------------ | ----- | --- | ---------- | ------------------------------------- |
| Auth/session lifecycle                               | X          | X        | X            | X     | X   | X          | BLOCKED: no live environment/accounts |
| Organization search and subscription                 | X          | X        | X            | X     | X   | X          | BLOCKED: no live environment/accounts |
| PatientNeed create → review → official request       | X          | X        | —            | —     | X   | Partial    | BLOCKED: no test environment/accounts |
| Donor response → hospital coordination → fulfillment | X          | X        | —            | —     | X   | Partial    | BLOCKED: no test environment/accounts |
| Blood Centre response and organization conversation  | —          | X        | X            | —     | X   | Partial    | BLOCKED: no test environment/accounts |
| Private conversation authorization/lifecycle         | X          | X        | —            | —     | X   | Partial    | BLOCKED: no test environment/accounts |
| Notifications and role filtering                     | X          | X        | X            | X     | X   | X          | BLOCKED: no live environment/accounts |
| Admin access boundaries                              | —          | —        | —            | X     | X   | —          | BLOCKED: no live environment/accounts |
| API validation/security regression                   | X          | X        | X            | X     | API | API client | NOT RUN                               |

## Known limitations

- No active local services, verified local QA identities, or provisioned
  isolated environment were available at reconnaissance time.
- Supabase and deployed services are not to be mutated during this review.
- Physical-device installation, offline behavior and accessibility require a
  device/emulator and a runnable API environment.
- Feature inventory is derived from checked-in routes, controllers, role model,
  and product docs; it will be amended if further implemented features emerge.
- This plan and the initial inventory are not a claim of completed testing.
