# BloodLink

BloodLink is a hospital-centered blood coordination platform connecting
hospitals, blood centres, and individuals through hospital-verified requests
and consent-based coordination.

## Technology and repository layout

- `apps/api`: NestJS + TypeScript API; Prisma persistence.
- `apps/web`: Next.js + TypeScript web client.
- `apps/mobile`: Expo + React Native mobile client.
- `packages/contracts`: API types shared across clients and server.
- `packages/validation`: shared request validation.
- `packages/ui`, `packages/config`: shared UI and configuration packages.
- `prisma`: PostgreSQL/PostGIS schema and ordered migrations.
- `docs`: current project guidance grouped by responsibility, plus an
  explicitly marked historical archive.

Both clients call the API; clients do not connect to the database directly.
Hospitals create official BloodRequests. Individuals submit PatientNeeds for
hospital review. Blood banks respond to hospital requests. BloodLink does not
perform medical screening, blood processing, or transfusion operations.

## Documentation

Start with the [documentation index](docs/README.md). The current branch
status is in [Current implementation status](docs/project/current-implementation-status.md)
and the phased completion plan is in
[Implementation roadmap](docs/project/implementation-roadmap.md). The detailed
handoff and reusable ChatGPT prompt are in
[PROJECT_COMPLETION_GUIDE.md](docs/PROJECT_COMPLETION_GUIDE.md), with progress
tracked in [FINAL_INTEGRATION_TRACKER.md](docs/FINAL_INTEGRATION_TRACKER.md).

Older docs live under `docs/archive/2026-10-26/` and are marked deprecated;
they are historical context, not current implementation instructions.

## Development

The repository is a pnpm workspace. See [Local development](docs/development/local-development.md)
for setup and commands, [Verification and release checklist](docs/quality/verification-and-release-checklist.md)
for quality gates, and [Deployment plan](docs/operations/deployment-plan.md)
for the unprovisioned Supabase, Render, and EAS rollout sequence.
