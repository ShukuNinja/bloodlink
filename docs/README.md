# BloodLink documentation

This directory is grouped by responsibility. The current implementation
status and completion tracker describe this branch; archived reports are
historical evidence and are not current instructions.

## Start here

- [Current implementation status](project/current-implementation-status.md)
- [Implementation roadmap and acceptance](project/implementation-roadmap.md)
- [Project completion guide and ChatGPT handoff prompt](PROJECT_COMPLETION_GUIDE.md)
- [Final integration tracker](FINAL_INTEGRATION_TRACKER.md)

## Product and architecture

- [Current product scope](product/current-product-scope.md)
- [Role-based user flows](product/user-flows.md)
- [System architecture](architecture/system-architecture.md)
- [Domain boundaries and API responsibilities](architecture/domain-boundaries.md)

## Development, verification, and operations

- [Local development](development/local-development.md)
- [Verification and release checklist](quality/verification-and-release-checklist.md)
- [Deployment plan](operations/deployment-plan.md)

## Historical documents

Superseded documentation is preserved under [archive/2026-10-26](archive/2026-10-26/README.md), with a deprecation notice and a replacement link in each document. Read it only when historical context is needed; verify all facts against current code.

## Source layout

The codebase uses a conventional pnpm workspace monorepo. Framework-required
route directories (`apps/web/src/app` and `apps/mobile/src/app`) stay in place;
domain implementation is grouped under each client’s `features` directory and
under API domain modules.

```text
apps/
  api/       NestJS API and server-side domain modules
  web/       Next.js routes, shared web API transport, and domain features
  mobile/    Expo Router screens, mobile API transport, and domain features
packages/
  contracts/ Shared API request/response types
  validation/Shared runtime validation schemas
  ui/        Shared UI package
  config/    Shared configuration package
prisma/      PostgreSQL/PostGIS schema and ordered migrations
docs/        Product, architecture, development, quality, operations, and project records
```

## Source-of-truth order

1. Current source code, schema, registered routes, and tests establish what is implemented.
2. `AGENTS.md` supplies repository rules. It currently requires reading `LEAD_FOUNDATION_SPEC.md`; that governance file remains protected from modification under its instruction.
3. The current product and architecture docs here describe intended behavior and module ownership.
4. The completion guide and tracker record the project plan and evidence.
5. Archived docs are superseded snapshots. They cannot override current code, current user decisions, or active repository instructions.

The local `LEAD_FOUNDATION_SPEC.md` file is currently present as a user-provided untracked file and was intentionally left at its required path. Its tracked status may differ on another checkout; do not silently add, alter, or remove it.
