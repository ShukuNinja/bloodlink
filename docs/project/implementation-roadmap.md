# Implementation roadmap and acceptance

Updated: 2026-10-26

Finish the project in gated, reversible phases. Keep the current local database
and user data intact. Do not call a phase complete without its acceptance
evidence.

## Phase 0 — Reconcile current workspace

- Inspect repository instructions, `git status`, branch, commits, scripts, and
  environment variable names.
- Preserve pre-existing user changes. Check upstream before merge/rebase; do
  not reset, clean, or blindly pull.
- Run typecheck/lint/tests/build on the current code and record actual output.

**Exit:** reproducible candidate commit and a known worktree/data baseline.

## Phase 1 — Close software verification gaps

- Add API integration coverage for search, subscriptions, organization
  conversations, PatientNeed conversations, all-role notifications, and
  fulfillment lock regressions.
- Run full API suite where local listeners and disposable DB are permitted.
- Run web/mobile typecheck, lint, tests, and production/export builds.
- Patch the installed Next.js 16.4.0 to the vendor's current fixed 16.4
  release, then rerun the production build; see [current status](current-implementation-status.md).
- Resolve failures in code or report environmental blocks explicitly.

**Exit:** checks pass on candidate code or every blocker has concrete evidence
and a local/CI action.

## Phase 2 — Verify database changes safely

- Inspect the complete migration history and expected pre-migration schema.
- Use a disposable PostgreSQL/PostGIS database, not the user's shared local DB.
- Apply migrations without reset; verify subscription-row preservation,
  indexes, constraints, spatial extensions, and `prisma migrate status`.
- Run DB-backed tests and fix forward with a new migration if required.

**Exit:** disposable database is migrated, query-tested, and reproducible.

## Phase 3 — End-to-end web/mobile readiness

- Test Individual, Hospital Admin/Staff, Blood Centre Admin/Staff, and Admin
  access separately, including cross-user denials.
- Test all requested workflows from `product/user-flows.md`.
- Make mobile sign-in/session state survive app restart using appropriate
  secure storage and server refresh/logout behavior; never log tokens.
- Check navigation, accessibility, loading/error/empty/pending states,
  responsive web layouts, and actual Android device behavior.

**Exit:** manual role matrix passes against a disposable/test environment and
mobile can authenticate reliably after restart.

## Phase 4 — Supabase staging and database cutover plan

- Owner provisions Supabase and confirms region/billing/backup needs.
- Enable PostGIS and run verified migrations on staging.
- Verify current Supabase pooler mode with the persistent Render API and
  PrismaPg adapter using official docs. Keep migration connectivity separate
  if necessary; current config exposes one `DATABASE_URL`.
- Decide whether local database records need migration and validate a rehearsed
  export/import before switching any production data.

**Exit:** staging API has database health and spatial/query checks; owner
approves any production cutover/data handling.

## Phase 5 — Render deployment

- Create API service from monorepo using workspace build/start commands.
- Configure Supabase pooled runtime URL and JWT/production settings as secret
  environment variables.
- Deploy API, verify health and database access, then deploy Next.js web with
  `BLOODLINK_API_ORIGIN` set to the HTTPS API origin.
- Verify public URLs, same-origin web rewrite, auth/session, and role journeys.

**Exit:** deployed web and API are reachable over HTTPS and pass smoke/manual
checks with test accounts.

## Phase 6 — Installable mobile test build

- Configure Expo/EAS using the confirmed account/project and correct app IDs.
- Build an internal/preview Android APK with `EXPO_PUBLIC_API_URL` set to the
  deployed HTTPS API; install privately on the test phone.
- Verify login, restart, subscriptions, conversations, request alerts, and
  network failures. Choose an iOS signing/distribution path only if required.

**Exit:** an installable build is tested on the target device. Play Store
publication is not required for private Android testing.

## Product decision still requiring confirmation

The current model does not permit blood banks to create BloodRequests. Confirm
whether the intended behavior is (A) only subscribe to and respond to
hospital-created requests, or (B) add a blood-bank-originated request workflow.
Option B changes domain ownership, authorization, schema/API, and lifecycle;
do not implement it without explicit architecture/product approval.

## Definition of done

- All in-scope user journeys pass API tests and manual role tests.
- Disposable DB migration is proven and the production DB plan is reviewed.
- Supabase runtime pooler and migration connectivity are verified.
- Render web/API and installable EAS Android test builds pass smoke checks.
- Trackers/status docs reflect measured results; no unsupported delivery claims.
- Final commit contains only reviewed project changes, no secrets or user files.
