# Deployment plan: Supabase, Render, and EAS

Updated: 2026-10-26

This is the project-specific deployment sequence, not a record of a completed
deployment. At the last code checkpoint, Supabase, Render, and EAS were not
provisioned. Confirm current vendor documentation before using dashboard names,
pooler flags, build settings, or pricing; those details can change.

Before any Render web release, patch the installed Next.js `16.4.0` security
blocker and rerun the production build. The official [October 14, 2026 security
update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) lists
`16.4.1` as the patched `16.4` release. This repository's network environment
could not download its pinned pnpm package to perform that dependency update.

## 1. Database preparation

1. Create a Supabase project in the intended region after the owner reviews
   account/billing settings.
2. Enable PostGIS using the Supabase-supported extension workflow.
3. Run the complete migration chain on a disposable/staging project first,
   including `20261012090000_organization_subscriptions_and_chat`.
4. Check whether the existing local database has data that must be retained.
   If so, create an explicit data export/import and validation plan before
   switching clients.
5. Use Supabase's pooled endpoint for the long-running API as requested, with
   a pooler mode verified against Render's process model and the current
   PrismaPg/node-postgres adapter guidance. Use a direct or supported session
   connection for migrations if the chosen pool mode cannot support them.
6. Current `apps/api/prisma.config.ts` reads one `DATABASE_URL`; it does not
   have a separate `DIRECT_URL`. Do not add a second connection variable or
   pooler query parameters without checking current official Supabase/Prisma
   guidance and testing both runtime and migration use cases.

## 2. Render API service

Expected workspace build/start commands (verify against current Render docs):

```text
Build: pnpm --filter @bloodlink/api build
Start: pnpm --filter @bloodlink/api start
```

Configure production secrets in Render's secret environment, never in Git:
`DATABASE_URL`, access/refresh JWT secrets and expiration settings, `NODE_ENV`,
and the runtime `PORT` behavior required by Render. Apply verified migrations
before starting application traffic. Test `GET /api/v1/health` and confirm the
database/PostGIS path needed by the application.

## 3. Render web service

Expected workspace build/start commands (verify current Render configuration):

```text
Build: pnpm --filter @bloodlink/web build
Start: pnpm --filter @bloodlink/web start
```

Set `BLOODLINK_API_ORIGIN` to the deployed API HTTPS origin. The Next.js
`/api/*` rewrite in `apps/web/next.config.ts` should continue to proxy browser
requests server-side. Verify auth and all role journeys against the real
deployed URLs before claiming success.

## 4. EAS mobile build

There was no `apps/mobile/eas.json` at the last inspection. Confirm the Expo
account/project owner and app identifiers before adding build configuration.
Use an EAS internal/preview Android profile that produces an installable APK
and set `EXPO_PUBLIC_API_URL` to the public API origin (the app appends
`/api/v1`). Verify current Expo instructions. Do not commit EAS tokens,
Android/iOS signing credentials, or other secrets.

Android can be tested through a private APK build without Play Store
distribution. iOS device distribution needs an appropriate signing path; the
owner must choose simulator, direct device, or TestFlight based on account and
device requirements.

## Release safeguards

- Never apply unverified migrations to a production database.
- Never reset or overwrite the existing local database as a deployment step.
- Record the exact migration revision and health/build checks without secret
  connection strings.
- Keep rollback/recovery steps and backups aligned with the chosen Supabase/
  Render plans.
- Follow [the verification checklist](../quality/verification-and-release-checklist.md).
