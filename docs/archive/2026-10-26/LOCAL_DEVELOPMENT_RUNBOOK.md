> **DEPRECATED — HISTORICAL REFERENCE ONLY (2026-10-26).** Use the current [replacement document](../../development/local-development.md) and [documentation index](../../README.md). This archived snapshot may contradict the current product or implementation; it is retained for historical context.`r`n`r`n# Local Development Runbook

## 1. Prerequisites

Previously used baseline versions:
- Node.js `v24.19.0`
- pnpm `12.10.1`
- Git
- PostgreSQL 18 with PostGIS 3.6.2
- PowerShell on Windows

These are a known historical environment, not necessarily strict minimum versions. Check `package.json`, the lockfile, and Prisma requirements for the current supported versions.

Docker is not part of this runbook.

## 2. Clone and inspect

```powershell
git clone https://github.com/ShukuNinja/bloodlink.git
cd bloodlink
git switch main
git pull --ff-only origin main
git status --short --branch
```

Before code changes, read root `AGENTS.md`, `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md`, `docs/API_CONTRACTS_AND_MODULE_OWNERSHIP.md`, and `docs/IMPLEMENTATION_STATUS_AND_HANDOFF.md`. The old `docs/LEAD_FOUNDATION_SPEC.md` was intentionally retired. If the working tree is not clean after clone/pull, stop and inspect rather than resetting or cleaning it.

## 3. Install dependencies

From repository root:

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
```

If frozen installation fails, report the error and inspect lockfile/package changes. Do not delete the lockfile as a workaround.

## 4. PostgreSQL and PostGIS

Use a local PostgreSQL instance with PostGIS enabled. Prefer a **separate developer database** such as `bloodlink_dev`; do not point a fresh developer setup at another developer’s existing database.

Verify service availability and PostGIS using your approved PostgreSQL tools. The exact database creation and extension permissions depend on the local PostgreSQL installation.

Do not run:
- `prisma migrate reset`
- destructive database drops/truncation
- `prisma db push` as a generic setup shortcut
- unreviewed seed scripts

Use the committed Prisma migrations and the repository’s approved migration procedure. First inspect migration status and the actual database target. Do not assume the existing database should be reset.

## 5. Environment variables

The API’s previously inspected environment schema required:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (at least 32 characters and different from refresh secret)
- `JWT_ACCESS_EXPIRES_IN` (example format: `15m`)
- `JWT_REFRESH_SECRET` (at least 32 characters)
- `JWT_REFRESH_EXPIRES_IN` (example format: `7d`)

`NODE_ENV` and `PORT` have development defaults in the inspected schema; API default port was `3001`.

Verify the actual env-file loading location and scripts in the current checkout before creating an env file. Do not create multiple `.env` files by guesswork. Use unique local secrets; never commit `.env` files or paste secret values into logs/chat.

Example placeholders only:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://<local-user>:<local-password>@localhost:5432/<developer-database>
JWT_ACCESS_SECRET=<unique-random-secret-at-least-32-characters>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different-unique-random-secret-at-least-32-characters>
JWT_REFRESH_EXPIRES_IN=7d
```

Do not use these literal placeholders as real credentials.

## 6. Generate Prisma client and inspect migrations

Follow the scripts declared by the current workspace. The known API tests/build invoke Prisma generation. Inspect migration status and confirm the database name before applying migrations. If migration history is inconsistent, stop and ask the repository owner rather than resetting or editing migration history.

## 7. Start the API

Terminal 1:

```powershell
pnpm --filter @bloodlink/api dev
```

Check the health endpoint in a browser or with PowerShell:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health
```

If startup reports `EADDRINUSE`, another process may already be listening. Inspect the process and health endpoint before stopping anything. Do not kill arbitrary processes.

## 8. Start the web client

Terminal 2, from repository root:

```powershell
pnpm --filter @bloodlink/web dev
```

Open `http://localhost:3000`. The Next.js proxy previously defaulted to `http://localhost:3001` and forwarded same-origin `/api` requests. Verify the current `next.config.ts` before changing proxy configuration.

## 9. Baseline checks

Run from repository root:

```powershell
pnpm --filter @bloodlink/web typecheck
pnpm --filter @bloodlink/web lint
pnpm --filter @bloodlink/web test
pnpm --filter @bloodlink/web build

pnpm --filter @bloodlink/api typecheck
pnpm --filter @bloodlink/api test
```

Previously reported baseline: web tests 11 passed, API tests 130 passed, typechecks/lint/build passed. Re-run and record the actual result on the current branch.

## 10. Test accounts and seed data

A fresh database may not have hospitals, memberships, or test accounts. Do not invent credentials or execute an unreviewed SQL seed file. Find the repository-approved seed workflow, review its effects, and use only a disposable developer database. If no safe seed procedure exists, document the gap and ask the owner to approve one.
