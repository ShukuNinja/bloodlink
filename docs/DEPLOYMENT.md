# BloodLink Web and API Deployment

This guide covers the current web + API delivery. Mobile deployment is outside
this scope. Hosting-provider-specific configuration is intentionally omitted.

## Runtime requirements

- Node.js and pnpm versions compatible with the repository lockfile.
- PostgreSQL with PostGIS enabled; BloodLink uses `geography(Point,4326)` and
  PostGIS spatial queries.
- A public HTTPS origin for the web app. Browser geolocation requires a secure
  context.
- A reachable API origin configured for the web server's `/api` rewrite.

## API environment

Set the following in the API runtime environment (see `apps/api/.env.example`):

- `NODE_ENV=production`
- `PORT` to the port exposed by the API service
- `DATABASE_URL` to the PostgreSQL/PostGIS connection string
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to different random secrets,
  each at least 32 characters
- `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` to values such as `15m`
  and `7d`

Do not reuse development or test secrets. Keep secrets in the host's secret
store rather than in source control or frontend build variables.

## Build and start

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @bloodlink/api db:generate
pnpm --filter @bloodlink/api db:migrate:deploy
pnpm --filter @bloodlink/api build
pnpm --filter @bloodlink/web build
```

Run the API with `pnpm --filter @bloodlink/api start`. Run the web server with
`pnpm --filter @bloodlink/web start`. The web server's
`BLOODLINK_API_ORIGIN` must point to the API origin; if unset, it defaults to
`http://localhost:3001`, which is suitable only for local development.

The browser calls the same-origin `/api/v1` path; Next.js rewrites that path to
the configured API origin. Route external traffic through HTTPS and expose the
web origin to browsers. Do not expose database credentials or API secrets to
the web build.

## Post-deployment checks

- Request `GET /api/v1/health` and confirm its database check succeeds.
- Register test accounts for Individual, Hospital, Blood Centre, and Admin;
  verify login routes to the selected account's workspace.
- Verify the database migration status against the deployment database before
  enabling real users.
- Test browser geolocation over HTTPS and confirm manual-coordinate search
  still works when permission is denied.
- Exercise PatientNeed review, BloodRequest lifecycle, donor/organization
  responses, and hospital subscription using non-production test records.

## Current deployment limitations

- Admin self-registration is enabled because that was explicitly selected for
  this application. A public deployment must account for the fact that anyone
  who chooses Admin receives platform-level access.
- In-app request alerts are derived from current matching requests and active
  hospital subscriptions. No notification/read history is stored. Push, email,
  and SMS delivery are not implemented.
- The Admin dashboard shows aggregate metrics and current account/organization
  records. It does not provide a historical event audit trail.
- A successful production build does not replace verification against the
  target PostGIS database, hosting secrets, TLS, and operational monitoring.
