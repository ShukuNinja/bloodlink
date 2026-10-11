# BloodLink Application Audit and Implementation Readiness

## Integration update — 11 October 2026

This update supersedes the baseline findings below wherever they conflict. The
original audit describes the checkout before the current `integration` work;
its route counts, missing-feature findings, and test results are historical.

The current web/API implementation includes four registration choices
(Individual, Hospital, Blood Centre, Admin), role/membership-derived login
redirects and protected pages, hospital discovery and subscriptions, the
Individual PatientNeed journey, hospital PatientNeed review and BloodRequest
lifecycle UI, donor and Blood Centre response workspaces, request-scoped
communication, current in-app alerts, and an Admin metrics/current-record view.
Donor remains an Individual capability. Organization coordinates use the
existing PostGIS geography field; donor identities remain anonymous to
hospitals. The database schema and generated Prisma client were kept unchanged.

The user-provided screenshot exposed a routing defect: `/hospitals` was caught
by the `/hospital` workspace prefix and denied to Individual users. That match
order is fixed and regression-covered. Current verification on `integration`:
API tests 155/155; web tests 29/29; API/web lint and typechecks, API compilation,
shared contract/validation checks, and Prisma schema validation pass. The
isolated optimized web build passes and emits all 15 routes. `git diff --check`
passes. Read-only migration status against the local `bloodlink_dev` database
reports eight existing migrations and an up-to-date schema; no migrations were
applied. Fresh local health checks return HTTP 200 for the web app and report
API/database status `ok`/`connected`.

**Readiness is not yet verified for release.** Authenticated browser journeys
for all roles, real-user end-to-end request/response workflows, production
secrets/hosting/TLS configuration, and production-target migration verification
remain outstanding. Public Admin self-registration is enabled by explicit
product choice and grants platform administration to anyone who registers as
Admin; account provisioning must be reconsidered before opening a public
production deployment. Notifications are in-app/current-record views only;
there is no persisted event history or push/email/SMS delivery. See
[`PROGRESS_LOG.md`](PROGRESS_LOG.md) for the detailed resumable checkpoint and
[`DEPLOYMENT.md`](DEPLOYMENT.md) for deployment setup.

**Audit date:** 11 October 2026 (Asia/Calcutta)  
**Scope:** Current checkout, static source review, existing tests, and attempted read-only local health check. This is not a complete browser or production data audit.

## Executive summary

**Readiness: not ready for functional release.** The API foundation and core PatientNeed / hospital review paths have substantive server-side access control, persistence, and in-memory integration tests. Authentication password handling and refresh-token rotation are also implemented at the API. However, the web client does not implement the session lifecycle implied by the API, only exposes public/authentication, hospital discovery and individual PatientNeed pages, and leaves most hospital, donor, subscription, response, notification and communication journeys unavailable or disconnected. The mobile app has a small set of screens and API helpers, but no durable session bootstrap or parity evidence.

No confirmed authentication bypass or cross-user/cross-hospital disclosure was found in the reviewed PatientNeed and D3 repository paths. The audited role enforcement is generally server-side. This conclusion is limited to reviewed routes/source and existing tests; no live authenticated negative tests ran. Most significant confirmed security defect is client-side token/session lifecycle: refresh credentials returned by the API are discarded, access credentials are stored in browser local storage, and logout only clears local state. Thus expiry requires manual sign-in and logout does not revoke the server refresh token. Local-storage token theft impact is elevated if an XSS flaw is later introduced; no XSS was established in this audit.

The report also records pre-existing working-tree changes without altering them: modified `apps/web/next-env.d.ts` and two untracked migrations. `docs/LEAD_FOUNDATION_SPEC.md` is absent; current documentation explicitly says it was retired and should not be recreated. This conflicts with `AGENTS.md`’s stale instruction to read it before changes. The only created file is this report.

## 1. Repository and environment baseline

- Root: `D:\Academics\full stack\bloodlink`; branch `main`, HEAD `f7e079d chore: finalize BloodLink web developer handoff`, tracking `origin/main`.
- Stack: pnpm 12 workspace; NestJS 11 / TypeScript API; Prisma 7 / PostgreSQL / PostGIS; Next.js 16 / React 19 web; Expo 57 / React Native mobile; shared contracts, Zod validation, UI and config packages.
- Root scripts: recursive `build`, `lint`, `typecheck`, and `test`; formatting script writes files and was not run.
- Package scripts: API `test` first runs build and `db:generate`, which can overwrite generated client files; this audit did not invoke it. API test specs describe Prisma-overridden in-memory stores, not the live database. D3/D4 specs emulate PostGIS; they do not verify real PostGIS behavior.
- Working tree at start: `M apps/web/next-env.d.ts` (two Next-generated reference paths changed); untracked `prisma/migrations/20261011033125_schema_sync/` and `prisma/migrations/20261011040000_restore_spatial_gist_indexes/`. No staged diff reported. These were preserved.
- `docs/LEAD_FOUNDATION_SPEC.md` does not exist. `docs/README.md` and `docs/DOCUMENTATION_DEPRECATION.md` identify the spec as intentionally retired; use current product scope, contract, handoff, flow and runbook docs as guidance. No implementation changes were made.
- User-reported UI observation: web home and hospital discovery load; coordinates appear editable and default to Lagos coordinates. Source confirms these are placeholders, not initialized values.
- API `GET /api/v1/health` was attempted and blocked with socket permission denial before an HTTP response. It is not independently verified in this run. No database status query was performed.

### Checks actually attempted

Commands actually run after approval: `pnpm --filter @bloodlink/web typecheck` (pass), `pnpm --filter @bloodlink/web lint` (pass), `pnpm --filter @bloodlink/web test` (11 pass), `pnpm --filter @bloodlink/api typecheck` (pass), `pnpm --filter @bloodlink/mobile typecheck` (pass). Web test emitted a Node `MODULE_TYPELESS_PACKAGE_JSON` warning for `apps/web/src/api/client.test.ts`; no test failures. Initial sandbox attempts failed before launch with directory access denied. No build, formatting, API lint/test, migration status, or write-capable check was run. API `test` invokes build and Prisma generation, which may modify generated files; it was not run under the audit-only “report is only file created” constraint. Historical API test counts in `docs/IMPLEMENTATION_STATUS_AND_HANDOFF.md` predate HEAD and are not current evidence.

## 2. Architecture and domain boundaries

Clients call the Nest API; web uses a same-origin `/api/v1` rewrite to the configured API origin, and mobile uses `EXPO_PUBLIC_API_URL`. Global API prefix and response envelope are configured in `apps/api/src/http/configure-api.ts`; `ApiResponseInterceptor` and `ApiExceptionFilter` provide the `{data}` / `{error}` convention. Prisma uses PostgreSQL; PostGIS geography locations are queried through raw parameterized SQL in hospital discovery. The schema separates `PatientNeed` (individual-to-hospital review handoff) from hospital-created `BloodRequest` and D3-owned responder assignments.

Code/docs ownership: D1 platform/auth/contracts/integration; D2 PatientNeed and hospital discovery; D3 hospital review and official request lifecycle; D4 donor/profile/subscription/response/coordination domains. Product rules explicitly exclude medical eligibility and precise donor location from ordinary projections. The D4 status document describes repository scaffolds; current code must be assessed directly and may have moved past that handoff snapshot.

## 3. Authentication and RBAC

### Supported role model

- Platform roles: `INDIVIDUAL`, `ADMIN` (`packages/contracts/src/index.ts`; Prisma `UserRole`). Public registration creates only `INDIVIDUAL` (`apps/api/src/auth/auth.service.ts`).
- Organization types: `HOSPITAL`, `BLOOD_CENTRE`.
- Membership roles: `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `BLOOD_CENTRE_ADMIN`, `BLOOD_CENTRE_STAFF`; membership and organization must be active for effective access (`AuthService.userHasRole`, `verifyOrganizationMembership`).
- `ADMIN` is defined but this route inventory contains no admin-only feature. Its operational permissions are therefore not evidenced; do not infer a global bypass.

### API authentication findings

- Registration normalizes email, uses bcrypt cost 12, does not accept a caller-supplied role, and returns a sanitized user plus access/refresh credentials. Login uses a dummy hash for unknown users, generic invalid-credential errors and rejects suspended users.
- Access JWT contains `sub`; every guarded request reloads the active user, so role/status changes are not dependent on a stale role claim. JWT verification checks signature/expiry through `JwtService`.
- Refresh JWT is hashed in storage, validated against persisted token/user status, then rotated transactionally. Logout revokes the supplied refresh token. Access JWTs are not revoked by logout and remain usable until expiry.
- `JwtAuthGuard`, `RolesGuard`, and membership helpers enforce at the API. `RolesGuard` denies when metadata requires a role and the principal does not satisfy any. Resource scope is separately checked in repositories for the reviewed D2/D3 paths.
- Organization role checks can establish that the user has an active matching membership somewhere, but resource isolation must still be enforced by service/repository queries. D3 source does this via `findMemberHospitalIds` and target ID filters; existing D3 tests include City/North isolation.

### Web/mobile session findings

- Web `apps/web/src/api/auth.ts`: register/login save only `accessToken`; refresh token returned by the server is not retained. `signOut()` only clears the token and does not call `/auth/logout`.
- Web `apps/web/src/api/client.ts`: access JWT is stored in `window.localStorage`; there is no refresh retry, session provider, `/auth/me` initialization on reload, expiry handling, or global 401 transition. `isSignedIn()` checks token presence only. A stale token can make UI appear signed in until an API rejects it.
- No route middleware or protected layout exists. Current routes render directly; backend guards still reject API access. Direct page URLs are therefore not reliably redirected based on session/role.
- Mobile keeps the access token in a module variable (lost on app restart), discards refresh token, and has no logout/session bootstrap. App layout is a bare Expo `Stack`.
- Role-specific redirects and organization selection are absent from client auth flow; successful sign-in always navigates to hospital discovery.

## 4. Role-permission verification matrix

The expectation column follows contracts and route declarations. PASS means code plus relevant existing in-memory tests support the conclusion, not live production verification.

| Actor / operation | Expected | Observed frontend | Backend enforcement / evidence | Result / impact |
|---|---|---|---|---|
| Anonymous: health | Public operational probe | No audited page dependency | `GET /health`; database probe | PARTIAL: live request blocked by socket policy |
| Anonymous: auth register/login/refresh/logout | Public auth endpoints | Auth form exists; refresh/logout not wired | Auth controller exposes routes; register role fixed to INDIVIDUAL | PARTIAL: API complete, client lifecycle incomplete |
| Anonymous: `/auth/me`, hospitals, PatientNeed | Denied | Pages render; API errors can be shown on hospital search | JWT guard; hospitals and PatientNeed controllers guarded | PASS for API source; live negative checks NOT TESTED |
| Individual: hospital discovery | Allowed | `/hospitals` with manual coordinates and search | `INDIVIDUAL` guard; input validation, active hospital filter | PARTIAL: works only when user provides coordinates; no browser geolocation |
| Individual: create/read/history/cancel own PatientNeed | Allowed, own records only | Create/history/detail UI exists | `INDIVIDUAL` guard; owner from JWT; owner-filtered reads and conditional cancellation; `patient-needs.spec.cjs` | PASS in in-memory tests; browser E2E NOT TESTED |
| Individual: another user’s PatientNeed | Denied / not found | UI has no arbitrary lookup controls, but direct route/API can be attempted | Repository scopes `id` and `submittedByUserId`; tests cover ownership | PASS in mocked API tests |
| Individual: create official BloodRequest | Denied; only hospital review creates one | No such UI route | No individual create route; D3 verify transaction creates BloodRequest | PASS by route/code review |
| Donor-capable individual: profile, matching, response, subscription | Only own profile / supported actions | No corresponding web pages or integrated controls in audited app routes | D4 guarded routes; services/repos are real current code, but no live verification | PARTIAL/NOT TESTED: API route role guard exists; full integration unclear |
| Hospital member with active membership | Review/manage only own organization’s PatientNeeds/requests | No hospital-facing web pages | `HOSPITAL_ADMIN/STAFF`; D3 repository filters member hospital IDs; `blood-requests.spec.cjs` | PASS for tested API behaviors; frontend journey absent |
| Hospital A: Hospital B resources | Denied / not found | No hospital UI | D3 queries scoped by active member hospital IDs; tests assert City/North isolation | PASS in in-memory tests |
| Hospital role without active membership / suspended org | Denied | No membership-aware UI | `userHasRole` and D3 membership filters require active membership/org; test fixtures cover memberships | PASS by source/test; not live tested |
| Blood-centre member | Supported organization response only where implemented | No blood-centre web pages | D4 `Roles('BLOOD_CENTRE_ADMIN','BLOOD_CENTRE_STAFF')`, service checks active centre membership | PARTIAL: API is implemented; no UI/end-to-end browser verification |
| Administrator | Only explicitly implemented admin operations | No admin navigation | Role enum exists; no admin feature/controller identified | NOT APPLICABLE for listed workflows; product/admin capability definition needed |

## 5. User-journey audit

| Journey | State | Evidence and gap |
|---|---|---|
| Home / public navigation | Partial | `apps/web/src/app/page.tsx` exists; live route rendering was user-reported, not browser-verified during audit. |
| Register/sign in | Partial | Web form calls API and routes to `/hospitals`; client omits refresh/logout/session restoration and role redirect. API auth is implemented. |
| Logout / refresh / expiry | Broken/incomplete | No visible logout control or refresh call in client helpers. Access token expiry yields API errors with no global session transition. |
| Protected navigation/deep links | Partial | Server API denies unauthorized requests, but app pages have no route guards and load without auth context. |
| Hospital discovery | Partial | API uses PostGIS and supports optional name filter, but schema and route require caller coordinates. Page requires both coordinates manually; `6.5244` / `3.3792` are placeholders only, state initializes to empty strings. No `navigator.geolocation` use found. API persists neither caller coordinates nor query; coordinates are sent to API for search. |
| Hospital selection → PatientNeed | Partial | Select routes to `/patient-needs/new` with hospital ID/name query params. API creates handoff, not official BloodRequest. Need actual browser verify continuity and server persistence. |
| PatientNeed history/detail/cancel | API + web partial | Routes/pages and owner-scoped API exist. No live DB or browser E2E; pending-only cancellation is conditionally enforced. |
| Hospital review / verify / reject | Backend implemented, web absent | D3 API and in-memory integration tests; no hospital queue/detail UI route. Verify atomically sets VERIFIED and creates one BloodRequest. |
| BloodRequest lifecycle / assignments | Backend implemented, web absent | API endpoints and repository logic exist; no web pages. Must verify race behavior and actual database behavior. Fulfillment reaches `FULFILLMENT_CONFIRMED`; schema includes `FULFILLED`, but reviewed flow does not establish final fulfilled state/DonationRecord lifecycle. |
| Donor profile / matching / response | Backend boundary exists, web absent | D4 controller and domain services found; no web pages or visible integration. Profile requires backend profile state; no public onboarding/profile UI. |
| Subscription / notification | API exists, web absent | D4 routes expose subscribe/unsubscribe/list. No UI controls; notification channel and actual delivery guarantees were not live verified. |
| Blood-centre response | Backend route exists, web absent | Membership-protected routes; no client journey. |
| Communication | Backend routes exist, web absent | Request-scoped APIs present; no browser integration verified. |
| Administrator | Not implemented in observed surface | Role exists but there is no supported admin UI/API journey identified. |
| Mobile | Partial scaffold / integration unverified | Expo routes include auth, hospitals, individual PatientNeed create/history/detail; additional domain API/hooks exist without corresponding screens in `apps/mobile/src/app`. No durable session or user journey verification. Docs explicitly put mobile outside current delivery target. |

## 6. Frontend audit

- Only five web page routes are present: home, auth, hospitals, PatientNeed create, history, detail. No layouts/guards beyond root shell, role-based nav, hospital admin pages, donor profile, subscription state, or admin pages.
- Web API helper centralizes requests and parses error envelopes; non-JSON errors become generic `MALFORMED`. It does not set request cancellation, refresh on 401, or clear invalid auth state.
- Auth form has browser required/minLength validation and API errors, but does not display field-level shared schema details. It always redirects to `/hospitals`.
- Hospital page coordinate inputs are blank state with `placeholder="6.5244"` and `placeholder="3.3792"`; placeholder text is not a value and is not submitted automatically. Radius is explicitly labeled meters. Radius default is empty; API service applies the 25,000 m documented default. Name filtering is still coupled to mandatory coordinates in both page and API schema, so name-only search is unsupported by current contract. No geolocation prompt/request exists.
- Hospital response shows hospital `latitude`/`longitude` to four decimal places. This is hospital location, not donor location. Precise donor location exclusion should still be confirmed on all donor response projections.
- Location text says coordinates are never stored; hospital page transmits them in the GET query for the search. This is not persistence, but URL/proxy/access logs may observe them; retention/log configuration was not audited.
- No automated browser, accessibility, responsive, keyboard, or manual UI checks were run. Existing pages use tables/forms; findings about layout quality are unverified.

## 7. Backend/API endpoint inventory

Global prefix: `/api/v1`; successful responses are enveloped. `PASS` here means route/service implementation is present, not all live DB conditions verified.

| Method and path | Purpose / authorization | Implementation and tests | Result / defects |
|---|---|---|---|
| GET `/health` | DB health; public | Prisma `SELECT 1`; no test result from this run | NOT TESTED live (socket access blocked) |
| POST `/auth/register` | Individual registration; public | bcrypt, normalized email, strict DTO; auth tests | PARTIAL client does not preserve refresh token |
| POST `/auth/login` | Sign in; public | generic invalid credentials; auth tests | PARTIAL client session lifecycle |
| POST `/auth/refresh` | Rotate refresh token; public with token body | persisted hash, expiry/revocation, transactional rotation; auth tests | API present, web/mobile unused |
| POST `/auth/logout` | Revoke refresh token; public with token body | revokes persisted refresh token; auth tests | UI never calls it |
| GET `/auth/me` | Current identity; JWT | reloads active user; auth tests | Web helper exists but unused for bootstrapping |
| GET `/hospitals` | Nearby/name-filtered hospital search; JWT + INDIVIDUAL | Zod coordinates, PostGIS `ST_DWithin`/distance, active hospital; hospitals tests | PARTIAL; mandatory coordinates; actual PostGIS not run in this audit |
| POST `/patient-needs` | Create review handoff; JWT + INDIVIDUAL | validates target active hospital; owner from token; tests | PASS in-memory |
| GET `/patient-needs`, `/:id` | Own history/detail; JWT + INDIVIDUAL | owner-scoped query and pagination; tests | PASS in-memory |
| POST `/patient-needs/:id/cancel` | Cancel pending own handoff; JWT + INDIVIDUAL | conditional status/owner update; tests | PASS in-memory |
| GET `/hospital/patient-needs`, `/:id` | Hospital review queue/detail; JWT + hospital membership | D3 repo filters member hospital IDs; D3 tests | API implemented, web absent |
| POST `/hospital/patient-needs/:id/verify`, `/:id/reject` | Review transition; JWT + hospital membership | conditional transition; verify creates unique BloodRequest transactionally; D3 tests | API implemented; final schema/DB race behavior unverified |
| GET `/blood-requests`, `/:id`, `/:id/responses` | Hospital request and response references; JWT + hospital role, resource scope in repo | D3 implementation and tests | API implemented; web absent |
| POST `/blood-requests/:id/cancel` | Cancel request; same as above | D3 repository conditional state logic | API implemented; web absent |
| POST `/blood-requests/:id/responders/:responseId/{select,standby,release}` | Assignment lifecycle | JWT + hospital role; request/member and response association checked in D3 repo | API implemented; no client; concurrency/DB tests absent here |
| POST `/blood-requests/:id/fulfillment/{start,confirm}` | Fulfillment state | JWT + hospital role; requires selected responder and valid state | API implemented; final `FULFILLED`/DonationRecord boundary unresolved |
| GET/PATCH `/donor-profile` | Own donor profile; JWT + INDIVIDUAL | D4 service path, profile projection excludes coordinates | API available; no UI; state setup and patch semantics need product confirmation |
| GET `/donor/blood-requests[/:id]` | Matching candidates/details; JWT + INDIVIDUAL | D4 matching service; route-level role | API available; no UI; real spatial query and privacy not live verified |
| POST `/blood-requests/:id/{accept,withdraw}` | Own donor response; JWT + INDIVIDUAL | D4 response service | API available; no UI; withdrawal vs selected assignment contract remains a risk |
| GET `/blood-centre/blood-requests[/:id]` | Centre requests; JWT + blood-centre membership | D4 matching service checks membership | API available; no UI |
| POST `/blood-requests/:id/organization-response[/withdraw]` | Centre response | JWT + centre role, service scopes membership | API available; no UI |
| POST/DELETE `/hospitals/:id/subscription` | Subscribe/unsubscribe own donor profile; JWT + INDIVIDUAL | D4 repository/service and unique relation | API available; no UI; duplicate/idempotency and profile-missing semantics should be verified |
| GET `/hospital-subscriptions` | List own subscriptions; JWT + INDIVIDUAL | D4 repository/service | API available; no UI |
| GET `/blood-requests/:id/conversation`, POST `/blood-requests/:id/messages` | Request-scoped conversation | JWT; service verifies participant/assignment | API available; no UI; direct negative authorization not run |

No public individual endpoint creates an official BloodRequest. No supported administrator route was found. There are no API routes for separate administrator management in the reviewed controller inventory.

## 8. Database and migration audit

- Prisma schema defines UUID primary keys, unique email, unique `(userId, organizationId)` membership, unique `patientNeedId` BloodRequest, unique donor/organization response per BloodRequest, and unique hospital/donor subscription. Foreign keys use explicit cascade/restrict rules. Query indexes cover owner history, hospital/status queues, request status, and response lookups.
- `Organization.location` and `DonorProfile.location` are `geography(Point,4326)` Prisma `Unsupported` fields. Prisma schema cannot declare GiST indexes; migrations are authoritative for spatial indexes.
- Migration `20261011033125_schema_sync/migration.sql` drops `DonorProfile_location_gist_idx` and `Organization_location_gist_idx`. Immediately subsequent `20261011040000_restore_spatial_gist_indexes/migration.sql` recreates both with `CREATE INDEX IF NOT EXISTS ... USING GIST(location)`. Ordered as named, the final migration state restores them; there is an intermediate migration state without spatial indexes if deployments stop after the first migration. Do not edit/apply during this audit.
- Earlier migrations and current DB migration history were not exhaustively diffed. `prisma migrate status` was not run because commands were blocked and the DB target was not independently confirmed. Schema/database drift and applied status remain unknown.
- Existing migration directories are untracked and were preserved. Their local status is material and must be reconciled by the owner before a future commit/deploy.
- No donor precise-location API projection was observed in the shared DonorProfile contract, but all matching, response and communication projections require continued verification.

## 9. Shared contracts and integration

- Contracts and validation packages centralize role enums, status enums, auth DTOs, PatientNeed and coordination request/response types. API controllers apply shared Zod schemas in most reviewed paths.
- PatientNeed `CreatePatientNeedSchema.hospitalId` checks nonempty string; service applies UUID validation and active hospital lookup; invalid UUID returns 400, missing/ineligible hospital 422. This is consistent at runtime but split across schema/service.
- Hospital discovery schema requires both coordinates and the UI likewise requires both. Docs explicitly leave no-coordinate/name-only browsing as a lead/product decision; it should not be changed without approval.
- Web API type expects error codes in a fixed union; global exception mapping is used. There is no common session abstraction shared by web/mobile.
- Existing D4 status document is historical: it calls donor-profile, subscriptions, donor-responses repositories intentional `NotImplementedException` scaffolds. Current checked-in repository files and D4 tests must be rechecked before relying on that assertion; report treats current service code as implementation evidence, while end-to-end support remains unverified.
- Shared UI package exists but source is minimal; the audited web pages primarily use direct native elements and global CSS. No duplicate primitive defect asserted without design-system requirements.

## 10. Confirmed defects, hypotheses, and decisions

### Confirmed findings

#### BL-AUD-01 — P1: Web/mobile do not implement refresh-token session lifecycle

- **Affected:** all authenticated users; login, refresh, expiry, logout.
- **Expected:** retain/use refresh credentials safely, rehydrate identity after reload, rotate on expiry, revoke on logout, and route on unauthorized response.
- **Actual:** client stores only access token; web stores it in local storage; neither client invokes refresh/logout; mobile state disappears on restart. Sign-out helper only clears browser storage.
- **Evidence:** `apps/web/src/api/auth.ts` (`register`, `login`, `signOut`, `fetchCurrentUser`); `apps/web/src/api/client.ts` (`ACCESS_TOKEN_STORAGE_KEY`, `apiRequest`); corresponding `apps/mobile/src/api/auth.ts` and `apps/mobile/src/api/client.ts`.
- **Reproduction:** sign in, reload web (token remains but identity is not fetched), wait for access token expiry and call a protected API (401 with no refresh recovery); invoke `signOut` and inspect that server logout is not called. Do not expose or copy token values.
- **Impact:** broken session continuity; refresh-token records remain active when only local sign-out occurs. LocalStorage increases credential exposure if script injection occurs.
- **Correction owner:** D1 auth/client foundation. **Dependencies:** decide browser token storage/session design, coordinate shared client behavior. **Regression risks:** concurrent refresh races, redirect loops, mobile persistence.
- **Future verification:** reload bootstrap, rotation, expired access retry, refresh reuse rejection, logout revocation, suspended user, and no token leakage/logging.

#### BL-AUD-02 — P1: Hospital review and request journeys have no web UI

- **Affected:** hospital admins/staff; PatientNeed review and BloodRequest lifecycle.
- **Expected:** authorized staff review queue, verify/reject, then manage resulting official request.
- **Actual:** D3 API and in-memory tests exist, but web route inventory has no hospital page. Individuals can create handoffs that cannot be reviewed through the shipped web app.
- **Evidence:** `apps/web/src/app` route inventory; API controllers `hospital-patient-needs.controller.ts`, `blood-requests.controller.ts`; services/repositories implement these operations.
- **Impact:** core product path is incomplete despite backend functionality.
- **Correction owner:** D3 UI integration, with D1 for cross-module/API contract review. **Dependencies:** resolve any remaining lifecycle and fulfillment contracts first.
- **Future verification:** role/member matrix and cross-hospital isolation through real API and browser, transition and reload assertions.

#### BL-AUD-03 — P2: Hospital discovery requires manual coordinates; name search cannot stand alone

- **Affected:** individuals; hospital discovery and PatientNeed selection.
- **Expected:** agreed current contract requires coordinates; product docs explicitly mark coordinate-free browsing as a decision. UI should make location input usable and communicate its behavior.
- **Actual:** two required text inputs; no browser geolocation. Placeholder values `6.5244`/`3.3792` are not initialized or submitted unless typed. Search API requires coordinates even with query. Radius is shown in meters.
- **Evidence:** `apps/web/src/app/hospitals/page.tsx`; `packages/validation/src/index.ts` `hospitalSearchSchema`; `apps/api/src/hospitals/hospitals.service.ts` and controller; `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md` section 6.
- **Impact:** confusing onboarding, inaccessible location discovery, potentially misleading description “current coordinates.” Coordinate values are transmitted in query but are not persisted by this workflow.
- **Correction owner:** D2 UI; lead/product approval required before changing API behavior. **Future verification:** browser permission granted/denied, invalid coords, name-only decision, radius units, empty/error states, privacy/log handling.

#### BL-AUD-04 — P2: Donor and subscription capabilities are not reachable through web UI

- **Affected:** individual/donor, blood-centre and hospital subscribers.
- **Expected:** only expose workflows supported by backend and show server-confirmed state.
- **Actual:** D4 API routes/services exist but no corresponding web pages or hospital-row subscription buttons; no current subscription state is rendered.
- **Evidence:** web route inventory vs `apps/api/src/d4/d4.controller.ts`; `apps/web/src/features/donor`, `subscriptions`, and related folders contain API/hooks, not app route pages.
- **Impact:** donor coordination and follow-hospital product promise is inaccessible; backend availability may be mistaken for feature completion.
- **Correction owner:** D4/current coordination domain for UI integration; D1 for shared session/contract alignment. **Future verification:** server-confirmed subscribe state after refresh, duplicate operations, notification path, role and ownership negative cases.

#### BL-AUD-05 — P2: Role-aware navigation and page access UX are missing

- **Affected:** all roles, direct URLs and refresh.
- **Expected:** role-correct entry point, protected-page behavior, permission-denied and expired-session UX; API remains authoritative.
- **Actual:** auth form always routes to `/hospitals`; no auth bootstrap or role-aware layout/guard is present. API guards protect data routes.
- **Evidence:** `apps/web/src/app/auth/page.tsx`; `apps/web/src/app/layout.tsx`; API guards/controllers.
- **Impact:** users reach unrelated or unusable pages; confusing access failures. No server-side bypass confirmed.
- **Correction owner:** D1 shared shell/auth; domain owners expose permitted journeys. **Future verification:** anonymous direct URL, individual, hospital member, inactive membership, centre, admin, refresh and revoked user.

### Hypotheses / unresolved decisions

- **BL-AUD-H1:** whether approved name-only hospital browsing is desired. Current API contract requires coordinates; product docs say resolve with lead rather than infer.
- **BL-AUD-H2:** whether mobile remains in active release scope. Current product scope excludes it; implementation exists but is not equivalent to web and session persistence is incomplete.
- **BL-AUD-H3:** how `FULFILLMENT_CONFIRMED` becomes `FULFILLED` and whether/when a `DonationRecord` is created. Schema/status docs expose these concepts, but reviewed D3 confirmation path does not prove an end-to-end record workflow.
- **BL-AUD-H4:** whether actual production deployment applies both untracked migrations in order and whether final PostGIS indexes exist. Local DB migration status was not checked.
- No confirmed cross-user or cross-organization authorization defect was found in reviewed D2/D3 code. D4 conversation, matching, response and membership isolation need further dynamic negative verification.

## 11. Automated checks and untested areas

- Existing API tests include auth, PatientNeed ownership and non-INDIVIDUAL denial, D3 cross-hospital membership isolation and transitions, D4 in-memory service flows, hospital validation/query behavior, and migration guard SQL assertions. D3/D4 use in-memory Prisma emulation; D4 spatial logic is emulated, not run against PostGIS.
- Current tests were not executed during this audit. Attempted web/API/mobile checks all failed before command launch due sandbox directory access; escalated rerun was requested. Historical checks in handoff docs are not current results.
- No browser session, API authenticated negative test, DB/migration status, real PostGIS query, production build, API test suite, admin journey, or mobile device run was completed.
- Live health request failed at socket access permission and returned no health payload.

## 12. Dependency-aware remediation roadmap

1. **D1: settle session design and correct auth lifecycle first.** Implement secure token/session retention, reload identity bootstrap, refresh rotation, logout revocation, and global 401 handling. API RBAC already has a substantial foundation; preserve it and add negative tests for unknown roles, suspended users and membership revocation.
2. **Lead + D3: confirm lifecycle/fulfillment contracts and reconcile migration state.** Verify migration history in a known non-production DB; ensure both index migrations are included in intended deployment sequence. Clarify final fulfillment/DonationRecord semantics and assignment/withdrawal race behavior.
3. **D3: build hospital vertical slice** using the existing API: queue/detail, verify/reject, official BloodRequest list/detail/actions, membership-aware navigation and error states. Keep API authorization as the security boundary.
4. **D2: complete individual vertical slice UX**: session-aware discovery; decide geolocation/name-only behavior with product owner; show PatientNeed confirmation/history/detail/cancel with server state and error handling.
5. **D4/current coordination owner: expose supported donor, subscription and blood-centre journeys** only after verifying profile setup, organization membership, notification delivery, response-withdrawal and conversation participant rules. Ensure no precise donor location leaks.
6. **D1 + all domain owners: mobile scope decision and parity plan**, if mobile is in release scope; implement durable auth before adding more screens.
7. **Integration: run full gates, real DB/PostGIS migration/query checks, and browser E2E** with approved non-production accounts. Include anonymous, cross-user, cross-organization, inactive membership and payload-tampering negatives.

Auth/session and authorization verification should precede UI polish or feature expansion because every authenticated path depends on reliable identity and expiry behavior. Existing API RBAC should be preserved and expanded by tests rather than redesigned without evidence.

## 13. Decisions requiring lead/product approval

1. Confirm the retired foundation spec remains retired and update stale `AGENTS.md` instruction in a separately authorized documentation task; this audit did not modify it.
2. Decide whether discovery can search by name without coordinates or must always require caller location; approve any API contract change before implementation.
3. Approve browser and mobile refresh-token storage/session strategy and expected logout semantics.
4. Define final BloodRequest fulfillment and DonationRecord boundary, including whether `FULFILLED` is reachable and by which actor/action.
5. Confirm active release scope for mobile and admin capabilities.
6. Reconcile the two untracked migrations with deployment history after verifying current DB migration status; do not discard them.

## 14. Post-fix verification checklist

- Anonymous requests to every protected endpoint return canonical 401; wrong role and missing/inactive membership return 403/404 as contracted.
- Individual cannot read/update/cancel another user’s PatientNeed; hospital A cannot read/review/change hospital B data; payload role/organization IDs do not grant access.
- Auth: normalized registration, duplicate email, password hash/no hash exposure, suspended users, access expiry, refresh rotation/replay, logout revocation, page reload and 401 recovery.
- Hospital discovery: permission grant/denial, manually entered coords, invalid values, name-only approved behavior, radius display, missing/no results, API errors, and privacy/log retention.
- PatientNeed-to-BloodRequest: owner view/cancel, hospital queue, verify/reject, exactly one transactional BloodRequest, persistence after reload.
- BloodRequest: legal/illegal transitions, concurrent cancel/verify/assign/fulfillment, selected responder constraints, final DonationRecord outcome.
- D4: donor profile safe projection, matching privacy, subscribe/unsubscribe persistence/idempotency, response withdrawal races, center membership, conversation participant isolation, actual notification delivery channel.
- Validate both PostGIS GiST indexes after ordered migrations; run discovery/matching against real PostGIS. Ensure migration history matches schema.
- Run web/API/mobile format-check, lint, typecheck, tests and production builds where in scope; browser E2E with approved non-production data; inspect console/network errors and responsive/accessibility behavior.

## Evidence index

- Repository instructions and baseline: `AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `docs/README.md`, `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md`, `docs/API_CONTRACTS_AND_MODULE_OWNERSHIP.md`, `docs/IMPLEMENTATION_STATUS_AND_HANDOFF.md`, `docs/IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md`, `docs/WEB_PAGE_FLOWS.md`, `docs/TESTING_AND_HANDOFF_CHECKLIST.md`.
- Auth/RBAC: `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts`, `guards/organization-membership.guard.ts`; `apps/api/test/auth.spec.cjs`.
- Individual: `apps/api/src/patient-needs/patient-needs.controller.ts`, `patient-needs.service.ts`, `patient-needs.repository.ts`; `apps/api/test/patient-needs.spec.cjs`.
- Hospital review/lifecycle: `apps/api/src/blood-requests/hospital-patient-needs.controller.ts`, `hospital-patient-needs.repository.ts`, `blood-requests.controller.ts`, `blood-requests.repository.ts`, `responder-assignments/responder-assignments.repository.ts`; `apps/api/test/blood-requests.spec.cjs`.
- D4 and matching: `apps/api/src/d4/d4.controller.ts`, `d4-scaffold.service.ts`, `donor-profile/`, `hospital-subscriptions/`, `responses/`, `matching/`, `communication/`; `apps/api/test/d4.spec.cjs`.
- Discovery: `apps/web/src/app/hospitals/page.tsx`, `apps/web/src/features/individual/hospitals/`, `apps/api/src/hospitals/hospitals.controller.ts`, `hospitals.service.ts`, `hospitals.repository.ts`, `apps/api/test/hospitals.spec.cjs`.
- Web/mobile auth clients: `apps/web/src/api/auth.ts`, `apps/web/src/api/client.ts`, `apps/web/src/app/auth/page.tsx`; `apps/mobile/src/api/auth.ts`, `apps/mobile/src/api/client.ts`, `apps/mobile/src/app/_layout.tsx`.
- Contracts/schema/migrations: `packages/contracts/src/index.ts`, `packages/validation/src/index.ts`, `prisma/schema.prisma`, `prisma/migrations/20261011033125_schema_sync/migration.sql`, `prisma/migrations/20261011040000_restore_spatial_gist_indexes/migration.sql`.

Key line references in the current checkout: web token storage and access-token helpers `apps/web/src/api/client.ts:14,41-55`; web auth token handling and local-only sign-out `apps/web/src/api/auth.ts:14-44`; discovery inputs and placeholders `apps/web/src/app/hospitals/page.tsx:10-14,78-93`; API refresh/logout/access authentication/current-role checks `apps/api/src/auth/auth.service.ts:86,108,121,152`; owner-scoped PatientNeed query/cancel `apps/api/src/patient-needs/patient-needs.repository.ts:93-105`; hospital membership-scoped review operations `apps/api/src/blood-requests/hospital-patient-needs.repository.ts:37-53,74-106`; D4 route roles `apps/api/src/d4/d4.controller.ts:56-199`; PostGIS hospital query `apps/api/src/hospitals/hospitals.repository.ts:38-64`; schema and migration SQL cited above. Other endpoint paths and symbols are listed in the inventory. No credentials, tokens, or account-specific data were included.
