# BloodLink Project Completion Guide

Updated: 2026-10-26  
Branch: `app/final-integration-fixes`  
Current estimate: **about 65% complete** toward a tested, deployed web and mobile release. This is a planning estimate, not a test-derived metric.

This guide is the handoff and execution plan for finishing the current BloodLink work. Keep it and `FINAL_INTEGRATION_TRACKER.md` current as work progresses. Do not use an old audit snapshot as proof of the current state; inspect the checked-out branch and run the relevant checks.

## 1. Project context and guardrails

BloodLink is a hospital-centered blood coordination platform. The current architecture is a modular NestJS API, PostgreSQL/PostGIS with Prisma, a Next.js web client, and an Expo/React Native mobile client.

- Web and mobile clients call the API. They must never connect directly to PostgreSQL/Supabase.
- The server owns authorization and workflow rules. Client visibility is not authorization.
- Hospitals create `BloodRequest` records. Individuals submit `PatientNeed` records to hospitals; a hospital verifies a need and can create a `BloodRequest`. Blood banks respond to hospital requests.
- BloodLink does not perform medical screening, blood testing, crossmatching, collection, processing, storage, issue, or transfusion.
- Do not expose an individual donor's precise location in ordinary API responses.
- Do not add a new domain entity or change a shared API contract casually. Follow the repository's active `AGENTS.md`, product-scope docs, ownership docs, and schema/migration conventions.
- Preserve all existing user work. Never use `git reset --hard`, `git clean`, destructive database commands, or an unreviewed schema reset to get a clean workspace.
- Never put secrets, passwords, JWTs, database URLs, Expo tokens, or deployment credentials in this document, commits, source files, logs, or chat.
- Do not push, publish, apply a production migration, or incur a paid service change unless the user explicitly asks for that action.

## 2. Current implementation state

The feature work below is implemented on the current branch:

- Prevent withdrawal of donor and blood-centre responses after the request leaves active coordination; the blood-centre screen hides the unavailable withdrawal action.
- Prevent request chat after fulfillment/cancellation and provide meaningful messaging for unavailable or disallowed request conversations.
- Provide a private conversation between a patient-need submitter and the hospital after the hospital verifies the need and creates a blood request. Close it when that request reaches a terminal state.
- Provide general hospital-to-blood-bank conversations, independent of blood requests.
- Search active hospitals and blood banks.
- Allow authenticated users to subscribe to hospitals and blood banks. An individual cannot be a subscription target.
- Provide web and mobile organization search, subscriptions, conversation lists, and request-alert screens/navigation.
- Provide separate hospital navigation entries for Patient needs and Blood requests.
- Make `GET /api/v1/notifications` available to any authenticated user. Individuals keep the existing open-request feed; users with active organization memberships and admins receive open requests from subscribed hospitals. Notifications are derived from current records; the product does not currently store read history or notification history.

The following details are intentional current limitations that need product or validation follow-up:

- Blood banks do not create `BloodRequest` records in the current model. If “blood-bank requests” means blood banks should originate requests, get explicit product/architecture approval before changing the model or workflows. Do not silently reinterpret hospital requests.
- Individual-to-hospital chat is tied to a verified patient need and its blood request. General individual-to-organization chat is not the implemented model. Keep the current no-direct-hospital/blood-bank-to-individual rule unless the product owner changes it.
- Subscription alerts are in-app, derived alerts. Do not claim push, email, SMS, background delivery, or durable unread counts exist.
- The new organization subscription/conversation schema changes have a migration at `prisma/migrations/20261012090000_organization_subscriptions_and_chat/migration.sql`. It has not been verified against a disposable database or applied to Supabase.
- Supabase is not provisioned. Render services and EAS builds are not configured.
- The mobile client has only in-memory access-token storage in its API client. Confirm current auth behavior and add safe persistence/session restoration before claiming reliable app-restart testing.

## 3. Git and workspace checkpoint

At the last recorded checkpoint:

- The requested branch is `app/final-integration-fixes`, based on the then-current `origin/main` commit `2cad8ee`.
- The branch contains these three local commits and they have not been pushed by this work:
  - `5e566f4 fix: lock fulfilled responses and close request chat`
  - `411a1c3 feat: integrate organization search and conversations`
  - `83e06ce feat: enable request alerts for all roles`
- Git identity is configured as `ShukuNinja <sri2410089@ssn.edu.in>`.
- The working tree also contains separate user edits/deletions and untracked files. The recorded examples are `apps/web/src/app/auth/page.tsx`, mobile auth/hospital/patient-need/style files, deleted `docs/DEPLOYMENT.md`, untracked `docs/LEAD_FOUNDATION_SPEC.md`, and `repomix-output.xml`. Re-run `git status --short --branch` before every operation; preserve these unless the user directs otherwise.
- No push or pull has been performed as part of the most recent feature work. Fetch only after inspecting the working tree, then reconcile branches deliberately. Never overwrite uncommitted user work.

## 4. Validation evidence and limits

Checks recorded for the recent feature work:

- API TypeScript build/typecheck passed.
- Web and mobile TypeScript checks passed.
- ESLint passed for affected source files (and previously across API/web/mobile source).
- Web tests passed: 29/29.
- Focused notification-service tests now pass: 3/3. Earlier focused API admin/notification checks passed before the latest notification test additions.
- Prisma schema validation and client generation passed before this checkpoint.
- `git diff --check` passed; Windows line-ending normalization warnings appeared but no whitespace errors were reported.

Not verified yet:

- The latest full API suite against a working local disposable database. A previous attempt in the constrained environment failed because the sandbox denied loopback listeners. Historical progress-log results refer to an earlier code/database checkpoint and must not be represented as a current full-suite pass.
- New API workflows for organization search, generalized subscriptions, general organization chat, and patient-need chat lack complete integration coverage.
- The migration has not been run against an isolated PostgreSQL/PostGIS database.
- Authenticated role-by-role browser/mobile journeys have not been completed on this final branch.
- No deployed API, web service, Supabase database, or installable EAS build has been verified.

## 5. Recommended completion sequence

### Phase A — Re-establish a safe working checkpoint

1. Read root `AGENTS.md`, the current product-scope rules, API ownership/contracts docs, local runbook, and this guide.
2. Run `git status --short --branch`, `git log --oneline --decorate -5`, and `git remote -v`.
3. Preserve dirty or untracked user files. Do not include them in a feature commit unless the user explicitly asks.
4. Confirm installed Node/pnpm versions against root `package.json` and `pnpm-lock.yaml`. The root pins `pnpm@12.10.1`; this environment previously could not download the pinned pnpm version while offline. Use repository scripts when available; if package-manager bootstrapping fails, report the exact error and use already-installed local binaries only where that gives an equivalent, transparent check.
5. Avoid a blind `git pull`. Fetch and inspect upstream changes first, then ask/decide whether a merge or rebase is safe with the current working tree.

### Phase B — Finish automated workflow coverage

Add API tests for:

- Active-organization search filters and unauthorized/invalid queries.
- Individual, hospital-member, blood-bank-member, and admin subscription access; reject inactive/individual targets and prevent cross-user deletion/list access.
- General hospital-to-blood-bank conversation creation, idempotency, membership checks, cross-organization privacy, and message authorization.
- PatientNeed conversation availability only after verification/request creation; submitter and assigned-hospital member access; unrelated-user denial; and read-only closure at fulfillment/cancellation.
- All-role notification access, individual feed behavior, subscription filtering for organization members/admins, and empty results without subscriptions.
- Existing response withdrawal and request chat lock behavior after fulfillment/cancellation.

Run the full API suite in an environment where its local listener and disposable PostgreSQL/PostGIS harness can run. Do not weaken tests or bypass the sandbox to claim a pass. If the constrained agent environment cannot bind loopback, record that and run it in the developer's normal local environment/CI.

Run web/mobile checks and add UI/API-client tests where important behavior is currently untested. Use the project's scripts and the current actual results:

```powershell
pnpm --filter @bloodlink/api typecheck
pnpm --filter @bloodlink/api lint
pnpm --filter @bloodlink/api test
pnpm --filter @bloodlink/web typecheck
pnpm --filter @bloodlink/web lint
pnpm --filter @bloodlink/web test
pnpm --filter @bloodlink/web build
pnpm --filter @bloodlink/mobile typecheck
pnpm --filter @bloodlink/mobile lint
pnpm --filter @bloodlink/mobile build
```

If a command is unavailable in the current shell, do not pretend it ran. Record the exact substitute and its scope.

### Phase C — Verify the migration safely

1. Read all migrations in timestamp order, not only the latest one. Confirm the disposable database starts from the expected prior migration and has PostGIS available.
2. Create/use a separate disposable database or isolated Supabase test project. Verify its exact host, database name, and that it contains no user data before applying anything.
3. Run Prisma format/validate/generate, migration status, and the migration deploy workflow against that disposable target. Do not run `migrate reset`, `db push`, or destructive SQL against a shared/local user database.
4. Check that existing `HospitalSubscription` rows survive the rename to `OrganizationSubscription`; verify foreign keys, indexes, PostGIS/GiST indexes, conversation constraints, and Prisma introspection/generation.
5. Run DB-backed tests and health checks against only the disposable environment. Record migration output and results without recording connection strings.
6. If SQL fails or migration history differs, stop and inspect; do not edit applied migration history or force a reset. Make a new forward-only migration after review.

### Phase D — Complete and manually validate the web/mobile clients

Use separate test accounts for Individual, Hospital Admin/Staff, Blood Bank Admin/Staff, and Admin. Record expected access before each journey; never use production patient or donor details in test data.

Web journeys:

- Register/login/logout/session restore and role/membership-specific navigation.
- Search hospitals/blood banks, subscribe/unsubscribe, inspect subscriptions, and check notification results.
- Hospital: separate Patient needs and Blood requests navigation; verify a need, open the scoped individual chat, create/manage the resulting request, and confirm chat/response controls close after fulfillment.
- Blood bank: find a hospital, subscribe, open a general hospital conversation, respond to a request, and confirm withdrawal locks after request state changes.
- Individual: submit a patient need, wait for hospital verification, message only within that need's conversation, and confirm the conversation closes when the request terminates.
- Confirm hospital/blood-bank users cannot initiate a direct individual chat, and the UI gives the intended meaningful explanation.
- Check responsive navigation, keyboard focus, loading/empty/error states, and small-screen layouts.

Mobile journeys:

- Fix and verify durable auth/session behavior first. The current access token is held only in module memory; investigate the existing auth implementation and add a suitable secure local storage/session-restoration flow rather than exposing tokens in logs or plain app UI.
- Test all implemented search/subscription/conversation/notification/patient-need screens using a reachable HTTPS API URL. `localhost` on a phone refers to the phone, not the developer computer; use a secured reachable development endpoint or LAN address for local device tests.
- Validate Android installation, app restart, sign-out, network errors, and role-based routes.

### Phase E — Provision and migrate to Supabase

Supabase has not yet been provisioned. The owner should create the project in the desired region and confirm the billing/retention expectations before production use. Check current official Supabase and Prisma documentation at execution time; pooler modes and adapter guidance can change.

1. Enable/verify PostGIS through Supabase's supported extension mechanism before applying migrations.
2. Confirm the Prisma `DATABASE_URL` contract. `apps/api/prisma.config.ts` currently reads `DATABASE_URL` for both Prisma configuration and runtime initialization; there is not yet a distinct `DIRECT_URL` migration setting.
3. Use the Supabase pooler for the running API as requested, choosing a mode compatible with this persistent Render API process and Prisma's `@prisma/adapter-pg`/node-postgres. Verify connection limits, SSL requirements, and any pooler-specific parameters from official docs; do not guess `pgbouncer` flags.
4. Use a direct or supported session connection for Prisma migrations/admin operations if the chosen transaction pooler cannot support migration semantics. With the current config this may mean setting `DATABASE_URL` to that migration URL only for the migration command; consider introducing a separate migration URL only after architecture/config review.
5. First deploy to an isolated Supabase staging project and run the verified migrations there. Check `prisma migrate status`, API health, PostGIS location queries, and essential workflows.
6. If any local Postgres data must be retained, inspect its scope and prepare an explicit export/import and validation plan before switching. Do not assume the database is empty, and do not run a schema reset against it.
7. Keep the pooler URI and all credentials in deployment secrets only. Never check them into Git or paste them into this guide/chat.

### Phase F — Deploy the API and web client to Render

No Render services are configured yet. Verify current Render monorepo instructions and service behavior at deployment time.

Likely service shape, subject to Render's current UI/docs:

- API service from repository root: install the pinned workspace dependencies; build with `pnpm --filter @bloodlink/api build`; start with `pnpm --filter @bloodlink/api start`. Provide production `DATABASE_URL` (Supabase pooler), `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `NODE_ENV=production`, and the Render-assigned `PORT` behavior. Ensure the migration has been applied before serving traffic.
- Web service from repository root: build with `pnpm --filter @bloodlink/web build`; start with `pnpm --filter @bloodlink/web start`; configure `BLOODLINK_API_ORIGIN` to the HTTPS API origin. The web app uses a same-origin `/api/*` rewrite through `apps/web/next.config.ts`; do not hardcode a deployment URL into client code.
- Mobile build-time public API origin: `EXPO_PUBLIC_API_URL` must be the public HTTPS API origin (without `/api/v1`, since the client appends that path). This value is public configuration, not a secret.

Deploy API and verify its `/api/v1/health` response and database connectivity first; then deploy web and test the browser rewrite, auth, and role journeys. Check logs for errors but redact secrets/tokens. Configure HTTPS, CORS only if actually needed, health checks, resource limits, and backups according to the current chosen plans. Do not claim deployment success until the public URLs work.

### Phase G — Produce installable mobile test builds

There is currently no `apps/mobile/eas.json`. The mobile app uses Expo Router and has an `EXPO_PUBLIC_API_URL` build-time setting.

1. Confirm Expo account/project ownership and current app identifiers; do not invent or overwrite `owner`, `projectId`, bundle identifiers, or signing identities.
2. Add the minimum EAS configuration after checking official Expo EAS documentation. Configure an internal/preview Android build that yields an installable APK for direct testing; Play Store distribution is not required for that test path.
3. Build with EAS against the deployed HTTPS API, install on the owner's Android device from the private build link, and verify login/session persistence plus the role journeys.
4. For iOS, choose simulator or a properly signed device/TestFlight path. Device distribution can require Apple signing and a paid Apple Developer account; confirm the owner's target before setting it up.
5. Keep EAS tokens/signing credentials in the Expo account/secret store, not repo files.

### Phase H — Release handoff

- Update `FINAL_INTEGRATION_TRACKER.md` with each completed check and concrete evidence (command/result, environment, build URL, migration ID), without secrets.
- Run `git diff --check`, inspect the full diff, check tracked/untracked state, and ensure no user files or `.env`/credentials are staged.
- Commit only reviewed project changes using the configured user identity. Push only when the owner requests it and upstream reconciliation is safe.
- Record remaining limitations and support/rollback steps. Do not label the app production-ready while a migration, auth, backup, security, or manual role journey remains unverified.

## 6. Expected completion percentage

The prior **~65%** estimate reflects implemented features, not deployment readiness. Re-estimate from evidence after each phase. A reasonable weighting is:

- Core requested features and server authorization: 35%.
- Automated integration and database migration verification: 20%.
- Authenticated web/mobile end-to-end QA and mobile session stability: 15%.
- Supabase provisioning/migration and operational health: 15%.
- Render web/API and installable mobile test deployment: 15%.

Do not count an item complete merely because code exists; require a successful test or deploy result appropriate to that item.

## 7. Reusable ChatGPT continuation prompt

Copy the prompt below into a new ChatGPT/Codex session and attach/open this repository. Keep the project files as the source of truth.

```text
You are helping me finish the BloodLink application in the repository I have attached. Stay specific to the actual checked-out code. Do not give generic deployment advice as if it were verified for this repo.

PROJECT CONTEXT
- BloodLink is a hospital-centered blood coordination platform.
- Architecture: NestJS TypeScript modular-monolith API; Prisma; PostgreSQL/PostGIS; Next.js TypeScript web client; Expo/React Native mobile client.
- Clients must communicate through the API only. Enforce access in the API. Do not expose precise individual donor locations. BloodLink does not perform medical screening, testing, crossmatching, collection, processing, storage, issue, or transfusion.
- Hospitals create BloodRequests. Individuals submit PatientNeeds to hospitals. Hospitals verify needs and may create BloodRequests. Blood banks respond to hospital-created requests.
- Do not invent a blood-bank-created request workflow. It is a product/architecture question because the current domain model only has hospital-created BloodRequests.
- Current approved communication rules: general hospital-to-blood-bank conversations are allowed; individual-to-hospital chat is scoped to a verified PatientNeed/BloodRequest; hospitals/blood banks must not initiate direct chats to individuals. Request chats close after fulfillment/cancellation.
- Any authenticated role may subscribe to an active hospital or blood bank; an individual cannot be a subscription target. Notification access is available to all authenticated roles. Individuals retain the current open-request feed; active organization members and admins receive open requests from hospitals they subscribe to. These are derived in-app alerts, not push/email/SMS, and there is no notification/read history.

CURRENT REPOSITORY CHECKPOINT (verify before relying on it)
- Requested branch: app/final-integration-fixes.
- Recorded commits: 5e566f4, 411a1c3, 83e06ce. Configured Git identity: ShukuNinja <sri2410089@ssn.edu.in>.
- The branch was based on origin/main at 2cad8ee at the last inspection. No push was recorded. Fetch/status may have changed; inspect before touching Git.
- There are pre-existing user edits/deletions/untracked files in the working tree. Run git status first, preserve them, and never use git reset --hard or git clean.
- Progress tracker: docs/FINAL_INTEGRATION_TRACKER.md.
- Full implementation and sequential plan: docs/PROJECT_COMPLETION_GUIDE.md (this handoff document).
- User-pasted repository constraints are in AGENTS.md. Read it and all referenced current architecture/product documents before changing files. The repository spec/docs may disagree; identify and reconcile those conflicts explicitly. Do not modify protected shared architecture files casually.
- Root package pins pnpm@12.10.1. apps/api uses apps/api/prisma.config.ts, schema ../../prisma/schema.prisma, migration path ../../prisma/migrations, and currently reads DATABASE_URL for Prisma/runtime. apps/web proxies /api/* through BLOODLINK_API_ORIGIN. Mobile API uses EXPO_PUBLIC_API_URL and appends /api/v1.
- Existing latest feature verification: API and web/mobile typechecks passed; focused API notification tests 3/3 passed; web tests 29/29 passed; affected-source lint passed. Full post-feature API suite, isolated DB migration test, authenticated role journeys, production deployment, and EAS install are not yet verified. Earlier/historical docs may report different test counts; distinguish old evidence from current evidence.
- Latest estimate was ~65% of the full goal; treat as approximate and revise based on actual evidence.

NOT YET DONE / SEQUENCE
1. Inspect branch, full Git status, docs/instructions, scripts, env/config names, and the current diff. Preserve every pre-existing user change. Confirm commands and current branch history rather than relying only on this prompt.
2. Add missing API integration coverage for organization search; all-role subscriptions/privacy; hospital-bank chat authorization; patient-need chat authorization and terminal closure; all-role notifications; fulfilled-response/chat locks. Run web/mobile checks. The constrained environment previously denied loopback listeners for full API tests; if so, report it and give me exact commands to run locally/CI rather than bypassing the restriction.
3. Verify the new migration 20261012090000_organization_subscriptions_and_chat and all prior migrations on a disposable PostgreSQL/PostGIS database. Confirm existing hospital subscriptions survive, indexes/foreign keys/PostGIS work, and Prisma status is clean. Do not migrate/reset any shared or user database.
4. Run authenticated browser and device journeys for Individual, Hospital Admin/Staff, Blood Bank Admin/Staff, and Admin. Resolve mobile auth durability before device restart testing: the current client stores its access token only in module memory. Do not log or expose tokens.
5. Supabase is not provisioned. Guide me through creating/selecting a project and enabling PostGIS. I requested pooled runtime connectivity. Verify current official Supabase + Prisma docs for the compatible pooler mode with this long-running Render API and PrismaPg/node-postgres adapter. Migrations/admin may need a direct/session connection. Current code has one DATABASE_URL, not separate DIRECT_URL; explain any proposed config change and make it deliberately. Never ask me to paste secrets into chat or commit them.
6. Render is not configured. Verify current official Render monorepo docs. Likely API commands are pnpm --filter @bloodlink/api build/start; likely web commands are pnpm --filter @bloodlink/web build/start. Configure BLOODLINK_API_ORIGIN for the web rewrite and production DB/JWT secrets for API. Deploy API/health first, then web, and verify actual public URLs.
7. EAS is not configured: apps/mobile/eas.json was absent at last inspection. Verify current official Expo EAS docs. Help create an internal Android preview build that can be installed directly as an APK (no Play Store needed), configure EXPO_PUBLIC_API_URL to deployed HTTPS API, and test on my device. Do not invent Expo project IDs/signing values. Explain iOS signing/TestFlight requirements only if relevant.
8. Clarify the product question: should blood banks originate their own BloodRequests, or should they only subscribe/respond to hospital-originated requests? Do not implement a new creation workflow/entity without my approval.
9. Update docs/FINAL_INTEGRATION_TRACKER.md as work completes. Commit only reviewed changes using the configured identity; do not push unless I ask. Keep unrelated user edits out of commits.

HOW TO GUIDE ME
- Work in small phases and tell me exactly what you need me to do in a dashboard (Supabase, Render, Expo), what information is safe to share, and what must stay secret.
- Before a step that changes a shared/production DB, deploys publicly, costs money, or needs account ownership/signing, make the exact proposed result reviewable and ask me to perform/approve that external action. Continue independent code/QA work in the meantime.
- Browse current official docs for changing service-specific instructions (Supabase, Render, Expo, Prisma). Cite those docs and separate verified project facts from recommendations/inferences.
- Do not hallucinate that an environment, migration, build, test, or deployment succeeded. Run it and report the result; otherwise mark it pending.
- Start by inspecting this repository and the current Git state, then resume the first incomplete phase in docs/PROJECT_COMPLETION_GUIDE.md. Keep the source-of-truth tracker updated.
```
