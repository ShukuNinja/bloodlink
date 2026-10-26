# BloodLink End-to-End Implementation Plan

Updated: 2026-10-26

This is the execution guide for completing and validating the BloodLink web and
mobile clients, staging database, and deployments. It is intended to be shared
with ChatGPT as project context. Keep this file and
[`FINAL_INTEGRATION_TRACKER.md`](../FINAL_INTEGRATION_TRACKER.md) current as
work progresses.

## Project context

BloodLink is a hospital-centered blood coordination platform with a NestJS API,
PostgreSQL/PostGIS and Prisma, a Next.js web client, and an Expo/React Native
mobile client. Both clients use the API; they do not connect directly to the
database. Server-side authorization is required for every protected action.

The implemented product scope documented in the repository includes:

- Individuals submit PatientNeeds. A hospital reviews a need and may create a
  BloodRequest.
- Hospitals create BloodRequests. Blood banks respond to those requests; blood
  banks do not create requests.
- Any authenticated user may subscribe to active hospitals and blood banks.
  Individuals are not subscription targets.
- Individuals can converse with the hospital for a verified PatientNeed and
  its related BloodRequest. Hospitals and blood banks cannot initiate direct
  contact with individuals.
- Hospitals and blood banks can have general conversations.
- Request actions and request-scoped conversation are unavailable after
  fulfillment or cancellation.
- Notifications are derived in-app alerts. Do not claim persistent read
  history or push, email, or SMS delivery unless those features are separately
  implemented and verified.

BloodLink does not perform donor screening, testing, crossmatching, collection,
processing, storage, issue, or transfusion. Ordinary responses must not reveal
precise donor location.

## Current checkpoint and known caveats

- The intended branch is `app/final-integration-fixes`. It exists locally, but
  the inspected checkout is detached at `537ef3a`; the branch ref points to a
  different commit. Reconcile and inspect both histories before changing code.
- The checked-out commit already upgrades Next.js from 16.4.0 to 16.4.3. The
  production build and web tests still need to be run on the intended branch.
- The tracker reports feature work present across web and mobile, with
  automated workflow coverage and disposable-database migration verification
  incomplete. Re-run checks; documentation is a checkpoint, not evidence that
  the current branch passes.
- Supabase, Render, and EAS deployment are not documented as provisioned or
  verified. Confirm their live state before relying on this assumption.
- The local `bloodlink` database was explicitly cleaned: application users,
  organizations, requests, subscriptions, memberships, tokens, conversations,
  and related records were verified empty. Do not recreate test records in a
  shared or production database.
- `AGENTS.md` requires reading `docs/LEAD_FOUNDATION_SPEC.md` before repository
  changes, but that file is absent from the inspected checkout and branch tree.
  Obtain the authoritative spec before foundation, schema, contract, or
  architecture changes. Do not invent a replacement or change protected
  integration surfaces without the required authority.

## Recommended execution order

The user's proposed order is close. These adjustments respect the dependencies:

1. **Task 1 — Reconcile Git/workspace state.** Confirm the intended branch,
   compare its commit with the detached checkout, inspect remotes/status/log,
   preserve all user changes, and establish a known candidate commit. Do not
   blindly switch, reset, pull, rebase, or overwrite work.
2. **Task 2 — Complete automated workflow coverage.** Add API tests for search
   filters and authorization; subscriptions across roles and ownership;
   hospital–blood-bank conversation privacy and membership; PatientNeed chat
   eligibility and closure; all-role notifications; and fulfillment locks.
   Run the full API suite and web/mobile checks, recording exact commands and
   results. Use a disposable database for DB-backed tests.
3. **Task 4 — Verify the Next.js security upgrade.** Version 16.4.3 is already
   present in the inspected detached checkout. Verify the intended branch has
   the fix, run web typecheck/lint/tests and production build, and update only
   if current official security guidance requires it.
4. **Task 3 — Prove database migrations safely.** Create/use a disposable
   PostgreSQL/PostGIS database. Apply the full migration chain without reset;
   verify migration status, schema, spatial support, indexes/constraints, and
   preservation behavior for existing subscription rows. Do not use production
   or the cleaned local database as a disposable target.
5. **Task 6 — Provision Supabase staging.** The owner provisions the project
   and reviews region, billing, backups, and access. Enable PostGIS, apply the
   already-verified migrations, and validate the pooled runtime connection
   using the API's PrismaPg adapter. Determine and test separate migration
   connectivity if the chosen pool mode requires it. Keep every connection
   string and credential in secret configuration, never Git or this plan.
6. **Create three staging test accounts.** Only after the staging schema and
   API are ready, create one Individual, one Hospital member, and one Blood
   Bank member, plus the minimum organization records/memberships required for
   those roles. Use clearly labeled non-production accounts and unique
   generated passwords. Return each account's email, role, and password
   directly to the user after creation; never place passwords in this file,
   commits, logs, or screenshots. Confirm with the user before any test data
   is created in a shared or production environment.
7. **Task 5 — Run end-to-end role and device checks on staging.** Use the
   staging accounts to test registration/login, organization search and
   filters, subscribe/unsubscribe, notifications, PatientNeed review and
   hospital chat, hospital–blood-bank general chat, request response,
   fulfillment/cancellation locks, unauthorized access, navigation, and
   responsive/loading/error/empty states. Record failures and fix them before
   release.
8. **Task 7 — Deploy API and web to Render.** Verify current Render
   configuration guidance. Configure secrets, health checks, pooled Supabase
   runtime access, migrations, API service, and web `BLOODLINK_API_ORIGIN`.
   Verify HTTPS endpoints and repeat critical role journeys on the deployed
   candidate. Do not expose credentials in source or logs.
9. **Task 8 — Build and install the mobile client.** Configure EAS with the
   owner's account and confirmed app identifiers. Set the mobile API origin to
   the deployed HTTPS API, build an internal Android APK, install it privately
   on the test phone, and verify login/session restoration, restart behavior,
   search, subscriptions, conversations, notifications, and request flows.
   Play Store distribution is not required for private Android testing.
10. **Task 9 — Record the product decision.** Confirmed: blood banks do not
    create BloodRequests; hospitals create them and blood banks respond. Keep
    this as a product constraint, not an implementation task. Any future
    change requires explicit product and architecture approval.
11. **Task 10 — Update project artifacts.** Update the tracker, implementation
    status, deployment notes, and this plan with verified outcomes, commit
    references, test evidence, and remaining blockers. Commit only reviewed
    project files; do not include credentials, user-owned files, or unrelated
    changes.

## Acceptance criteria

The project is ready for the intended test release when:

- The intended branch and candidate commit are known, and no user changes were
  lost or accidentally included.
- Automated API, web, and mobile checks pass, including the new workflow
  coverage.
- The Next.js production build passes on the candidate.
- The migration chain is proven on an isolated PostgreSQL/PostGIS database and
  applied successfully to Supabase staging.
- The API uses the approved Supabase pooled runtime connection, and health and
  spatial/database paths work.
- Manual role-based staging journeys pass for Individual, Hospital, and Blood
  Bank, including forbidden actions and terminal request states.
- Render API and web are reachable via HTTPS and their critical workflows
  pass.
- An installable Android build talks to the deployed API and passes device
  checks, including app restart/session behavior.
- The tracker and status documents describe only measured results; no secrets
  or unsupported claims are committed.

## Guidance for ChatGPT continuing this project

Start by reading the active `AGENTS.md`, this plan, the integration tracker,
the completion guide, product scope, and current implementation status. Inspect
`git status`, branch, recent history, and current scripts before acting. Treat
documentation as a checkpoint and verify each status claim against the current
checkout. Follow the order above, make focused changes, preserve existing user
work, and report evidence and blockers plainly. Do not bypass the API, invent
entities or contracts, expose donor locations, or put secrets in files. Browse
current official vendor documentation for Supabase, Render, Expo/EAS, Prisma,
and Next.js when their instructions may have changed. Do not deploy, apply a
production migration, spend money, or create accounts in shared/production
systems without explicit user authorization. Continue independent local work
while any external approval is pending.
