# Local development

Updated: 2026-10-26

## Workspace

The root is a pnpm workspace pinned to `pnpm@12.10.1`; workspaces are
`apps/*` and `packages/*`. Check `node --version` and `pnpm --version` before
installing. If Corepack cannot retrieve the pinned pnpm offline, report that
exactly; do not remove or rewrite the lockfile as a workaround.

```powershell
pnpm install --frozen-lockfile
```

## Database and API environment

Use a separate developer PostgreSQL database with PostGIS enabled. The API
reads `apps/api/.env` through `dotenv/config`; its example is
`apps/api/.env.example`. Required settings include `DATABASE_URL`,
`JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, and
`JWT_REFRESH_EXPIRES_IN`. Use distinct random secrets at least 32 characters
long. Never commit or print real values.

Prisma configuration lives in `apps/api/prisma.config.ts` and references
`../../prisma/schema.prisma` and `../../prisma/migrations`. Inspect the exact
database name and current migration status before applying migrations. Do not
run `migrate reset`, `db push`, destructive SQL, or unreviewed seed scripts.

## Start services

Terminal 1, API:

```powershell
pnpm --filter @bloodlink/api dev
```

Check `http://localhost:3001/api/v1/health`.

Terminal 2, web:

```powershell
pnpm --filter @bloodlink/web dev
```

Open `http://localhost:3000`. The web client uses the same-origin `/api/*`
rewrite to `BLOODLINK_API_ORIGIN`, which defaults to
`http://localhost:3001`.

Terminal 3, optional mobile:

```powershell
pnpm --filter @bloodlink/mobile dev
```

Set `EXPO_PUBLIC_API_URL` to an API origin reachable by the test device. On a
physical phone, `localhost` means the phone itself. Use a secure, reachable
development API or local network address for device testing.

## Common quality gates

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

Run relevant checks after each meaningful change and record the actual command
and result. See [verification and release checklist](../quality/verification-and-release-checklist.md).
