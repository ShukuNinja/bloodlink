# Current implementation status

Updated: 2026-10-26

This is the current branch snapshot. It describes source/test evidence and
external setup separately; it is not a production-readiness claim.

## Git checkpoint

- Branch: `app/final-integration-fixes`.
- Latest commits include `96d6bc5` (Next.js security patch) and `6097844`
  (documentation reorganization); verify `git log` for later feature commits.
- Configured Git author: `ShukuNinja <sri2410089@ssn.edu.in>`.
- The workspace has pre-existing uncommitted changes. Inspect `git status`
  before staging; preserve unrelated/user-owned files.

## Feature status

| Area                               | Current status                                                             | Evidence/remaining qualification                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fulfillment locks                  | Implemented                                                                | Server and UI prevent response withdrawal/request chat after terminal transitions.                                                                 |
| Individual–hospital conversation   | Implemented for verified PatientNeed/BloodRequest                          | Request-scoped, authorized, and closed with terminal request state. Not a general chat.                                                            |
| Hospital–Blood Centre conversation | Implemented as a general conversation                                      | Server checks active organization memberships. Automated integration coverage remains incomplete.                                                  |
| Organization search                | Implemented for active hospitals and blood banks                           | Web directory loads every active record, with name/type filters, A→Z/Z→A sorting, and transient PostGIS radius filtering.                          |
| Subscriptions                      | Implemented for authenticated users following active hospitals/blood banks | Local schema mismatch was fixed by applying four reviewed migrations; browser subscribe/unsubscribe and list were verified.                        |
| Notifications                      | Implemented as derived in-app alerts for all authenticated users           | Individual open-request feed remains; organization members/Admins see requests from subscribed hospitals. No persistent history or push/email/SMS. |
| Navigation                         | Implemented on web; key mobile links/screens added                         | Hospital has separate Patient needs/Blood requests links. Complete role-by-role and responsive/device QA.                                          |
| Backend/web/mobile                 | Web/API candidate verified                                                 | Mobile remains buildable per the prior Expo export; complete real-device and role-matrix verification remains.                                     |

## Verification recorded on the feature checkpoint

- API typecheck/build passed.
- Web and mobile TypeScript checks passed.
- Affected-source ESLint passed.
- Web suite passed 29 tests.
- Full API suite passed **147/147** after the organization-directory tests
  were added. Web tests passed **29/29**.
- Prisma schema validation/client generation passed before the feature
  checkpoint.
- `git diff --check` passed with Windows line-ending warnings.

The authenticated browser smoke test verified the combined directory, all six
active database organizations (five hospitals and one blood centre), name and
type filters, descending sorting, radius filtering, subscription creation and
removal, and the subscriptions page. The temporary smoke-test subscription was
removed afterward. This does not establish a full role/device matrix or a
deployment.

## External services and release state

- Database: development has used PostgreSQL locally. Supabase is not
  provisioned; no migration was applied there.
- Local database: `bloodlink` at `localhost:5432` was missing four migrations.
  Preflight found no donor-response, conversation, subscription, or donation
  rows to orphan; all four migrations were applied successfully. Verify from a
  separate disposable database before release.
- Web/API: no Render services/public deployment verified.
- Mobile: no EAS config/build verified; mobile access-token state is in memory,
  so sign-in does not currently survive an app process restart.
- Blood-bank-originated requests: unsupported by current domain model;
  hospitals create BloodRequests and blood banks respond.

## Reorganization verification follow-up

After correcting two stale hospital-only subscription test assertions, the
initial post-reorganization API suite passed **144/144** on 2026-10-26 using
the approved local listener access. API, web, and mobile TypeScript checks passed; ESLint passed
across API/web/mobile source; web tests passed **29/29**; Expo export bundled
both iOS and Android clients successfully. Relative Markdown links resolve and
the active documentation set passes Prettier.

Next.js was upgraded from 16.4.0 to **16.4.3** in commit `96d6bc5`, with the
security upgrade hint enabled in Next config. The exact version installed,
web lint, typecheck, 29 tests, and production build (17 routes) all passed.
The vendor's [October 14, 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
identified the need to move from the vulnerable release to a patched 16.4.x.

See [the live tracker](../FINAL_INTEGRATION_TRACKER.md) and [completion
guide](../PROJECT_COMPLETION_GUIDE.md) for the remaining work and exact handoff
prompt.
