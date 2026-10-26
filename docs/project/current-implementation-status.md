# Current implementation status

Updated: 2026-10-26

This is the current branch snapshot. It describes source/test evidence and
external setup separately; it is not a production-readiness claim.

## Git checkpoint

- Branch: `main` at `15baaf3` (`feat: complete BloodLink integration workflows`),
  fast-forwarded to `origin/main` for this completion pass. The prior
  `production` branch remains at `7880955`.
- The working tree contains the completion-pass changes. Inspect `git status`
  before staging. No commit or push has been made.

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
| Backend/web/mobile                 | Candidate builds and automated checks pass                                 | Physical-device and deployed role-matrix checks remain. Mobile session restoration/rotation is implemented and unit-tested.                        |

## Verification recorded on the feature checkpoint

- API lint and typecheck passed; the full API suite passed **152/152** after
  adding focused organization and PatientNeed conversation authorization tests.
- Web typecheck and lint passed, web tests passed **29/29**, and the production
  build passed on lockfile-pinned Next.js **16.4.3** after syncing dependencies.
- Mobile typecheck and lint passed, mobile tests passed **14/14**, and Expo
  export bundled Android and iOS successfully.
- All **10 migrations** applied successfully to an isolated PostgreSQL 18 +
  PostGIS test cluster. Prisma reports the schema up to date. Spatial queries
  work, and a seeded subscription survived the rename migration.
- Prisma CLI migration status was verified using `DIRECT_URL` while
  `DATABASE_URL` pointed at an invalid host.
- `git diff --check` passed with Windows line-ending warnings.

The authenticated browser smoke test verified the combined directory, all six
active database organizations (five hospitals and one blood centre), name and
type filters, descending sorting, radius filtering, subscription creation and
removal, and the subscriptions page. The temporary smoke-test subscription was
removed afterward. This does not establish a full role/device matrix or a
deployment.

## External services and release state

- Database: Supabase is not provisioned yet; no migration was applied there.
  The user is provisioning it manually. Migration verification used an
  isolated cluster and did not touch the existing local database.
- Web/API: no Render services/public deployment verified.
- Mobile: access and refresh tokens are stored with Expo SecureStore, restored
  on startup, and rotated after a 401; tests verify persistence and refresh.
  No EAS config, installable device build, or physical-device restart test has
  been verified.
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
