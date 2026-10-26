# BloodLink system architecture

Updated: 2026-10-26

## Runtime shape

BloodLink is a multi-client application with one modular API. The web and
mobile apps call the API; neither client may connect directly to PostgreSQL.

```text
Next.js web client ─────┐
                       ├── NestJS REST API ── Prisma ── PostgreSQL + PostGIS
Expo mobile client ────┘
```

The backend is a modular monolith. Microservices, direct database access from
clients, and client-owned copies of business rules are out of scope.

## Repository layout

- `apps/api`: NestJS controllers, services, authorization, persistence adapter, and server configuration.
- `apps/web`: Next.js App Router pages in `src/app`, reusable API transport in `src/api`, and role/domain features in `src/features`.
- `apps/mobile`: Expo Router screens in `src/app`, mobile API transport in `src/api`, and domain features in `src/features`.
- `packages/contracts`: shared TypeScript API contracts.
- `packages/validation`: shared Zod validation schemas.
- `packages/ui` and `packages/config`: shared package boundaries; inspect their current implementation before expanding use.
- `prisma/schema.prisma` and `prisma/migrations`: canonical persistence schema and ordered migration history.
- `docs`: product, architecture, development, quality, operations, and project records.

This layout is already conventional for a pnpm monorepo. Keep Next.js and
Expo route-convention files under their required `app` directories. Do not move
source files just to rename folders; change code layout only for a specific
responsibility boundary and update imports/config/tests in the same reviewed
change.

## Request/data path

1. A client calls the NestJS API through the shared API client.
2. `JwtAuthGuard` authenticates guarded requests; `RolesGuard` and domain
   services/repositories enforce authorization and resource scope.
3. Controllers validate input and delegate to domain/application services.
4. Prisma persists to PostgreSQL. Location discovery uses PostGIS geography
   and spatial indexes; do not replace it with client-side location matching.
5. The API projects safe response contracts. Never return ORM records blindly
   or expose precise individual donor location in ordinary user-facing data.

## Hosting intent

- Target web/API host: Render.
- Target database: Supabase PostgreSQL with PostGIS, not the current local
  PostgreSQL database.
- Requested runtime database connection: Supabase pooled connection mode.
- Mobile test distribution: EAS internal/preview build; Android should be
  installable directly for testing without Play Store distribution.

No Supabase project, Render service, or EAS build profile was provisioned at
the last checkpoint. See [deployment plan](../operations/deployment-plan.md).
