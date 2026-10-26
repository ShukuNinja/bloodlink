# Verification and release checklist

Updated: 2026-10-26

## Automated checks

- [ ] API typecheck, lint, build, and full test suite pass.
- [ ] Web typecheck, lint, tests, and production build pass.
- [ ] Mobile typecheck, lint, and Expo export/build pass.
- [ ] Organization search and subscription authorization/eligibility have API
      coverage.
- [ ] General hospital–blood-bank conversation access, pair idempotency, and
      message authorization have API coverage.
- [ ] PatientNeed conversation requires verification/request creation, enforces
      submitter/hospital membership, and closes on terminal request state.
- [ ] All-role notification access and subscription filtering have API tests.
- [ ] Fulfillment withdrawal/chat lock regressions remain covered.
- [ ] Schema and migration are validated on a disposable PostgreSQL/PostGIS
      database; existing subscriptions are preserved.
- [ ] No secrets, generated snapshots, or unrelated user files are included.

## Manual authenticated journeys

- [ ] Individual: search/subscribe, patient need, hospital verification, scoped
      chat, open requests, notifications, refresh/re-login.
- [ ] Hospital: Patient needs and Blood requests navigation, review and
      request creation, organization chat, subscription alerts, fulfillment.
- [ ] Blood Centre: request response, general hospital chat, subscription
      alerts, withdrawal lock after lifecycle transition.
- [ ] Admin: current admin capabilities and organization subscriptions/
      notifications without treating Admin as an authorization bypass.
- [ ] Direct hospital/blood-bank-to-individual chat is rejected with a clear
      explanation.
- [ ] Unauthorized cross-user and cross-organization records are inaccessible.
- [ ] Mobile login, app restart/session behavior, role routes, offline/error
      states, and physical Android installation are checked.

## Deployment evidence

- [ ] Supabase staging project has PostGIS enabled and verified migrations.
- [ ] Runtime API uses the agreed Supabase pooled connection mode; migration
      method is verified independently.
- [ ] API is deployed to Render and `/api/v1/health` reports healthy database
      connectivity.
- [ ] Web is deployed to Render and its same-origin API rewrite reaches the
      deployed API over HTTPS.
- [ ] Android EAS internal/preview build installs directly on the test device.
- [ ] Public URLs, build artifact, migration revision, health result, and
      test-account role matrix are recorded without secrets.

## Reporting rule

Mark a checklist item complete only after its command, test, or manual action
has actually succeeded on the candidate commit/environment. Clearly separate
historical evidence, current source-level checks, disposable database results,
and production evidence.
