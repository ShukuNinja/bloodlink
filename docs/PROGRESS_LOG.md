# BloodLink Integration Progress Log

Last updated: 2026-10-11
Working branch: `integration`
Repository remote: `origin` (`https://github.com/ShukuNinja/bloodlink.git`)

## Latest continuation checkpoint (2026-10-11)

- User clarified the intended workflow: no advance donor preferences; show Individuals all open BloodRequests; an Individual's response means they volunteer, and the hospital reviews/manages the donor list and verifies compatibility. A clarification was sent to authorize the schema/client migration this requires, because the existing `DonorResponse` foreign key requires a `DonorProfile` with blood group and preferences. No database/schema change has been made pending that authorization.
- Corrected the Admin account table's role label: it now presents `Hospital Admin/Staff` or `Blood Centre Admin/Staff` from active organization membership instead of showing those organization accounts as platform `INDIVIDUAL`. Web lint/typecheck pass; web tests pass **29/29**; isolated production build passes with all 15 routes. Generated Next type references were restored afterward. `git diff --check` passes (CRLF normalization warnings only).
- The user reported an Internal Server Error for the Hospital flow and that a Blood Centre account appeared as an Individual. Local API health currently returns `status: ok`, `database: connected`; the current browser session is an Individual and the attached screenshots do not show the Hospital 500. Asked which step/route fails; preserve account credentials and do not put them in logs. Current RBAC routes Hospital/Blood Centre access using active organization membership, while the database platform role remains `INDIVIDUAL` for organization members.
- Corrected the hospital BloodRequest detail message after fulfillment confirmation. It now reflects the server transaction: a selected Individual donor produces a DonationRecord, while a selected Blood Centre does not. This removes a stale claim that the API could not confirm the record. Updated the acceptance plan to record this boundary and the current terminal status (`FULFILLMENT_CONFIRMED`; no later `FULFILLED` transition). Web lint and typecheck pass; web tests pass **29/29**; isolated production build passes and prerenders all 15 routes. Next.js rewrote generated type references during the build, so I restored `next-env.d.ts` and `tsconfig.json` to their prior state. Authenticated browser role journeys and production environment checks remain outstanding.
- Added a registration-only disclosure when Admin is selected: it states that Admin can view platform metrics/current account and organization records and that anyone with access to the public form can create that account. This preserves the user-approved public Admin signup behavior. The changed auth page passes ESLint and TypeScript checks; the latest isolated optimized production build also passes with all 15 routes.
- Fixed the Individual discovery-route access bug shown in the user-provided screenshot. `/hospitals` matched the broader `/hospital` prefix first and incorrectly required Hospital membership; the route match now handles Individual `/hospitals` before the singular Hospital workspace prefix. Added a regression assertion for Individual access and Hospital-account denial. Web tests pass **29/29**, web lint and TypeScript check pass. `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` were restored after Next's isolated build rewrote generated type paths; only the optional `BLOODLINK_NEXT_DIST_DIR` override remains in Next config, defaulting to `.next`.
- Revalidated the active local app: `http://localhost:3000` returns HTTP 200, and `http://localhost:3001/api/v1/health` reports `status: ok`, `database: connected`. Added an integration-date addendum to `AUDIT_REPORT.md` to supersede its pre-integration feature-gap snapshot and distinguish current verified state from remaining release blockers.
- Reconciled the final handoff docs with current code: D4 repository classes containing `NotImplementedException` are legacy, unregistered scaffolds; the active services have the implementation. Updated `TESTING_AND_HANDOFF_CHECKLIST.md` and `IMPLEMENTATION_STATUS_AND_HANDOFF.md` so they no longer imply the active workflows are 501s. Browser E2E remains outstanding.
- The user supplied local test credentials for a browser walkthrough. The computer-use skill prohibits automating Windows authentication forms, so the user needs to sign in manually in the already-running local browser; no credentials were entered, echoed, or stored by this continuation. Continue the walkthrough after the user indicates the session is authenticated.
- Re-read the user's controlled-completion request and active repository instructions. The user explicitly directed review, integration, and correction of the existing D3 implementation; D3 review/fixes are authorized. The user chose to keep the schema immutable and remove donor-name disclosure. Removed the newly added Individual display-name capture/persistence/projection and the un-applied migration, preserving the two pre-existing migration directories. The generated Prisma client remains untouched.
- `pnpm format:check` could not launch because pnpm failed to canonicalize the workspace path (Windows OS error 5). Running the installed Prettier CLI directly did execute and reported style issues in 155 files across the repository. No files were reformatted. This includes pre-existing source files, so formatting needs a scoped decision/review before changes are made.
- Initial local HTTP checks were blocked by the command sandbox's socket permission error; the same read-only checks later succeeded with approved local-service access (see evidence below).
- `git diff --check` remains clean (line-ending normalization warnings only). The branch is still `integration`; no commits or pushes were made.
- Read-only verification with local-service permission confirmed `http://localhost:3000` and `http://localhost:3001/api/v1/health` both return HTTP 200; API health reports `database: connected`.
- Browser inspection confirmed the public home and registration pages render, and the registration-only selector offers Individual/Hospital/Blood bank/Admin. Hospital registration shows organization name and location fields plus explicit device-location action. Direct `/admin` access without a session redirects to `/auth?next=%2Fadmin`. The current in-app browser tab shows the sign-in form; no form was submitted or data changed, so authenticated workflows remain pending.
- Latest complete API suite after removing schema-dependent identity code: **155/155 passed, 0 failed**. It includes isolated route/persistence tests and a disposable PostgreSQL/PostGIS harness; no migrations were applied to `bloodlink_dev`.
- Latest web test suite: **29/29 passed**. API TypeScript compilation, API/web lint, web TypeScript check, and shared contract/validation TypeScript checks pass after cleanup. The isolated web production build now passes after the donor-anonymity copy and hospital-discovery authorization fix, prerendering all 15 routes without competing with the active development server.
- After removing the un-applied display-name migration, read-only Prisma `migrate status` against `bloodlink_dev` reports **8 migrations found; database schema is up to date**. No migrations were applied.
- The user asked to run the server. Both existing services are live: web `http://localhost:3000` and API `http://localhost:3001/api/v1/health` return HTTP 200, with database connected. The local dev servers remain available for manual testing.

## Resumption summary

- The requested `integration` branch has been created from the existing local `main` checkout. It includes the full current working tree so no earlier edits were dropped. No commit or push has been made.
- The user confirmed four public registration choices: Individual, Hospital, Blood Bank, and Admin. Account type is selected only during registration; login should route from the server-confirmed role/membership.
- Hospital and blood-bank registrations should create their organization and initial administrator membership using the existing schema. Admin self-registration is explicitly user-authorized for this project.
- Latest location decision: collect hospital and blood-centre coordinates during organization registration. This is implemented against the canonical geography field; Prisma schema validation passed. Database-backed and browser journey verification remain pending.
- Latest identity decision: keep the existing schema immutable and do not collect or disclose an Individual donor name. Hospitals see Blood Centre organization names; Individual donor responses remain anonymous, including after selection.
- Latest coordination decisions: hospital confirmation of fulfillment creates a `DonationRecord` for a selected Individual donor (not for a selected Blood Centre); notifications are in-app only and derived from existing requests/matching/subscription records, with no event/read history.
- Current product scope is web + backend; mobile is out of scope according to `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md`.
- `docs/LEAD_FOUNDATION_SPEC.md` is absent and the current `docs/README.md` says it was intentionally retired. The active architecture and flow references are `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md`, `docs/WEB_PAGE_FLOWS.md`, `docs/API_CONTRACTS_AND_MODULE_OWNERSHIP.md`, and `docs/IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md`.

## Work already present in the tree

- Web access/refresh token session lifecycle, logout, reload restoration, and protected-route handling.
- Explicit browser-geolocation request and coordinate/radius validation for hospital discovery.
- Hospital PatientNeed and BloodRequest web pages consuming existing APIs.
- Registration supports the four agreed choices. Account type is collected only during registration; Hospital/Blood Centre create an organization and admin membership; Admin self-registration is enabled per explicit direction. Auth identity returns memberships for routing after login.
- Location support includes browser geolocation and manual coordinates for Individual hospital discovery and organization registration.
- Organization registration now requires latitude/longitude for Hospital and Blood Centre accounts. The registration UI supports manual coordinates or a user-clicked browser geolocation request; API validation bounds-checks coordinates and persists them into the existing `Organization.location` PostGIS geography field in the same transaction as account and membership creation. No schema change was made.
- Donor acceptance now checks `availabilityStatus === AVAILABLE` and `coordinationStatus === ACTIVE` server-side; donor request matching returns no results to unavailable or paused profiles. Added a regression case to the D4 integration suite.
- Hospital response references include response status and Blood Centre organization names. Individual donor responses remain anonymous before and after selection. The Hospital BloodRequest detail page offers select/standby/release actions and gates lifecycle actions by request state.
- Blood Centre users can now reload their own response statuses via `GET /api/v1/blood-centre/responses`, scoped to active Blood Centre memberships. The Blood Centre workspace displays current response status and allows withdrawing an accepted response. Added API integration coverage for membership scoping.
- Hospital and selected Individual workspaces now have request-scoped message panels backed by the existing conversation API. Sender labels are shown as “You” or “Other participant”; account IDs and emails are not exposed.
- D3 fulfillment start now verifies the currently selected responder’s D4 response is still ACCEPTED. A withdrawn selected response blocks fulfillment, and the hospital page retains release controls so staff can recover. Added a regression case.
- Request conversation access closes when the selected responder withdraws, without changing D3 assignment state. Added a D4 boundary regression case.
- Hospital fulfillment confirmation now validates that the selected responder still has an accepted response and, for a selected Individual donor, creates the DonationRecord in the same Prisma transaction as the D3 state transition through the D4 Donations service. Selected Blood Centre fulfillment does not create a donor record.
- `GET /api/v1/notifications` and the Individual notifications page provide a current, read-only alert feed from matching requests and active hospital subscriptions. It applies donor availability/urgency preferences, excludes answered requests, and stores no notification or read-history rows. Push/email/SMS are not implemented.
- Donor is a capability under Individual, not a fifth role. Individual users can set donor preferences, browse blood-group matched requests, accept/withdraw responses, and review their own response states. Added the approved own-scoped `GET /api/v1/donor/responses` contract.
- Hospital discovery includes server-backed subscribe/unsubscribe state and requires the Individual's optional donor preferences/profile before subscription.
- Hospital subscription actions now track pending state per hospital, so one pending mutation does not block other rows. Failed reads have an explicit retry action, and failed mutations refresh server state to reconcile ambiguous outcomes.
- Donor and Blood Centre response actions now track pending request IDs per row, allowing unrelated requests to remain actionable. Failed response mutations trigger a status reload and retain an action error for the user.
- Blood Centre workspace lists existing BloodRequests and submits an organization response through existing D4 routes. It does not manage inventory.
- Admin workspace shows platform aggregates and paginated current accounts/organizations. It does not display or persist event history, per user choice.
- `AdminModule` imports `AuthModule`; `patient-needs.spec.cjs` test store now provides the membership list method needed by the enriched auth identity.
- Updated `docs/IMPLEMENTATION_STATUS_AND_HANDOFF.md` to distinguish live D4 service implementations from unused legacy 501 repository scaffolds and to document notification delivery limitations.
- Added `docs/DEPLOYMENT.md` with web/API environment, PostGIS, build/start, HTTPS/geolocation, and operational-check guidance; linked it from the README. Existing D3/D4 module comments that described implemented paths as placeholders were corrected.
- Existing uncommitted changes predate this log, including `apps/web/next-env.d.ts` and the two local migration directories. Preserve them; do not reset, clean, apply migrations, or alter migration history. The Prisma client was regenerated only after the user explicitly approved it on 2026-10-11.

## Current verification snapshot

Latest worktree evidence on 2026-10-11:

- Web tests: **29/29 passed** using `node --test "src/**/*.test.ts"` from `apps/web`.
- Full API suite: **155/155 passed** (`node --test test/*.spec.cjs` from `apps/api`, run with local socket access). This covers API route/service behavior plus the repository's isolated persistence and spatial test harnesses; it does not exercise authenticated browser journeys.
- API lint, web lint, API/web/contracts/validation TypeScript checks passed using package-local binaries.
- API production TypeScript compilation passed without running Prisma generation at that earlier checkpoint. The client was regenerated later after user approval (see the revision entry below).
- Web production build passed with elevated workspace access after the sandboxed Next.js attempt failed at Windows path canonicalization. It compiled and prerendered all 13 routes, including `/notifications` and the role-specific workspaces.
- After the per-hospital subscription and donor/Blood Centre per-row action changes, web lint, typecheck, all 29 web tests, and the 13-route production build passed again.
- Prisma schema validation passed without applying migrations.
- Current configured `bloodlink_dev` database is reachable and API health reports it connected. Read-only migration status reports eight migrations found and the database schema up to date. The two pre-existing local migration directories remain preserved. Isolated PostgreSQL/PostGIS route and persistence tests pass.
- The repository `pnpm --filter ... typecheck` commands are blocked before compiler launch by Windows path canonicalization (Access denied, OS error 5). Direct package-local compiler/linter commands can run.
- `git diff --check` passes; Git emits only line-ending normalization warnings.
- Formatting check was executed: workspace `pnpm format:check` is blocked by Windows path canonicalization, while direct Prettier reports 155 files with formatting differences; no formatting writes were made. Browser-authenticated role journeys and deployment-environment checks remain unverified.
- In-app alerts are read-only and derived from current records; push/email/SMS and notification/read history are not implemented. Do not treat source-level checks as proof of database or browser end-to-end readiness.

## Next steps

1. Convert legacy profile-based D4 tests and fixtures to the direct-Individual workflow. Keep migrations unapplied to the configured development database until release deployment is explicitly intended.
2. Review the complete diff, including all new/untracked route files; preserve the pre-existing migrations and `next-env.d.ts` edits.
3. Verify request-scoped conversation controls for the hospital and selected donor in a browser; donor selection is detected through the server-authorized conversation endpoint.
4. The latest full API suite passes 155/155. Keep its in-memory and isolated database coverage distinct from authenticated browser verification.
5. Exercise role journeys in a browser with approved test accounts: registration/login redirects, PatientNeed → hospital review → BloodRequest, Individual donor response/withdrawal, Blood Centre response, Admin metrics, and subscription persistence.
6. Confirm production environment values and deployment target; no secrets are present in this log. Do not commit or push unless explicitly authorized.

## Product decisions still reflected in this checkpoint

- Admin audit view uses existing/current records and aggregates only; no event history is stored or displayed.
- Donor is an Individual capability, not a registration role. Own response status is available through the approved `GET /api/v1/donor/responses` endpoint.
- Organization registration must collect coordinates (registration/API coverage and Prisma schema validation pass; configured database and browser verification remain pending).
- Hospital coordination displays Blood Centre names; Individual email appears only after a Hospital selects the response (API projection tests pass; authenticated browser verification remains pending).
- Blood Centre accounts can reload their own response statuses (full API suite passes; browser verification remains pending).
- Request-scoped conversation UI is available to the hospital and selected individual responder using existing participant authorization (implemented; browser verification remains pending).
- Fulfillment cannot start if the selected responder has withdrawn their response (full API suite passes; browser verification remains pending).
- Hospital fulfillment confirmation records a DonationRecord for the selected Individual donor transactionally (full API suite passes; configured database verification remains pending).
- In-app request alerts are derived from existing live records; no push transport or notification history is present (full API suite passes; browser verification remains pending).
- Public Admin self-registration remains enabled because the user selected all four roles as self-registerable. Restrict this before any public production launch if the product decision changes.

## 2026-10-11 — Registration and donor workflow revision

- User clarified that the Hospital 500 occurs during registration. Root cause: the database CHECK requires a Hospital geography value on its initial insert, while registration previously inserted first and updated coordinates afterward. Registration now inserts the organization and PostGIS location together inside the account transaction; the API registration tests for Hospital/Blood Centre coordinates pass.
- User approved changing the Prisma schema and adding a migration to remove the DonorProfile prerequisite from active volunteer response, subscriptions, conversations, and confirmed donation records. User separately approved regenerating the checked-in Prisma client. Migration created at `prisma/migrations/20261011050000_direct_individual_donor_records/`; it backfills existing references to their owning User and has not been deployed to `bloodlink_dev`.
- Active Individual workflow is being revised: show open requests to all Individual accounts, let the user accept/withdraw, and leave compatibility review and selection to the Hospital. The Individual donor preferences and location form has been removed from the `/donor` UI; notifications now derive from available requests and the caller's own responses.
- Hospital response references continue to hide Individual identity until the response has a SELECTED assignment, then show the account email (the existing identity field). Blood Centre names remain visible. Fulfillment confirmation now records the selected Individual user directly.
- Admin workflow metric now counts Individuals with accepted responses instead of legacy DonorProfile rows. Admin account labeling remains organization-aware.
- API Prisma schema validation passed. Prisma client generation passed. API TypeScript production build passed after repairing stale types; API and web lint plus web typecheck passed.
- API suite: **142/142 passed** in the latest run; legacy profile-preference and profile-radius matching suites are skipped because those workflows were removed. API lint passed. Web lint, TypeScript check, and tests (**29/29**) passed. Production web build compiled and prerendered all 13 routes.
- `git diff --check` passed with line-ending normalization warnings only. The production build changed `next-env.d.ts` and `tsconfig.json`; both were restored to their clean pre-build state.
- Authenticated browser role journeys have not been repeated after this change. The configured `bloodlink_dev` database still needs the new migration before the direct-user response schema can run against it; no migration has been applied.
- `pnpm --filter ...` sandbox commands hit Windows path canonicalization Access Denied; the checks above were run with elevated local workspace access.

## 2026-10-11 — BloodRequest, Individual requests, and alerts 500s

- Root cause found: the checked-out API schema expects direct `DonorResponse.userId`, while the configured database migration remains pending and still stores `DonorResponse.donorId`. Prisma-backed response-list queries therefore raise database errors.
- Hospital response references, Individual response-status reads, and alert filtering now check the live table layout and read either the migrated direct-user link or the legacy DonorProfile link. The migration remains pending per the user's explicit choice.
- Hospital BloodRequest detail and Individual open requests now load independently from their response panels, so a response-panel failure no longer hides the primary request data. Notifications copy now reflects the current open-request workflow.
- Individual donor identity remains private in hospital response references; Blood Centre names remain visible.
- When the database still has the legacy response layout, Individual accept/withdraw and donor fulfillment confirmation now return a clear service-unavailable migration prerequisite instead of leaking as a generic internal error. No migration was applied.
- API TypeScript build passes; scoped API/web lint passes; web typecheck and tests pass (29/29); full API integration suite passes (142/142). `git diff --check` is clean (Git only reports line-ending normalization warnings).
- Local API health check returns `status: ok` and `database: connected` after the update.
- User then authorized migration changes to resolve the database mismatch. `20261011050000_direct_individual_donor_records` was applied to local `bloodlink_dev`; Prisma now reports all 9 migrations applied. Existing donor-linked rows were backfilled through their DonorProfile owner before old foreign-key columns were removed.
- After applying the migration: API build passes; API lint passes; full API suite passes **142/142**; web lint, typecheck, and tests pass (**29/29**); isolated production web build compiles and prerenders all **13** routes; API health reports the database connected. Generated Next.js config rewrites from the isolated build were restored.
- The local browser session could not be inspected: Computer Use could not confidently determine the current URL and stopped before interacting with the browser. No credentials were entered and no browser state was changed.
- Remaining release checks are environment-specific: manually exercise authenticated role journeys in the browser, configure production secrets/API origin/HTTPS/PostGIS, and decide whether public Admin self-registration remains acceptable (it is currently enabled per the user's earlier choice).
