# BloodLink â€” Developer Documentation

**Status:** New documentation set
**Audience:** Incoming developer completing the BloodLink web application and API
**Scope:** Web client + backend only. The mobile application is out of scope for this delivery.

## Read in this order

1. [`PRODUCT_SCOPE_AND_DOMAIN_RULES.md`](PRODUCT_SCOPE_AND_DOMAIN_RULES.md) â€” what the product does and must not do.
2. [`WEB_PAGE_FLOWS.md`](WEB_PAGE_FLOWS.md) â€” page-by-page user journeys, including hospital subscriptions.
3. [`API_CONTRACTS_AND_MODULE_OWNERSHIP.md`](API_CONTRACTS_AND_MODULE_OWNERSHIP.md) â€” endpoint expectations and D2/D3/D4 ownership boundaries.
4. [`LOCAL_DEVELOPMENT_RUNBOOK.md`](LOCAL_DEVELOPMENT_RUNBOOK.md) â€” prerequisites, environment setup, startup, and safety.
5. [`IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md`](IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md) â€” implementation sequence and definition of done.
6. [`IMPLEMENTATION_STATUS_AND_HANDOFF.md`](IMPLEMENTATION_STATUS_AND_HANDOFF.md) â€” what is implemented versus intentionally scaffolded for developer ownership.
7. [`TESTING_AND_HANDOFF_CHECKLIST.md`](TESTING_AND_HANDOFF_CHECKLIST.md) â€” validation and final handoff requirements.
8. [`DOCUMENTATION_DEPRECATION.md`](DOCUMENTATION_DEPRECATION.md) â€” how to retire the previous documentation set without losing history.

## Project facts to verify at the start

- Repository: `https://github.com/ShukuNinja/bloodlink.git`
- Monorepo package manager: pnpm.
- API: NestJS/TypeScript + Prisma/PostgreSQL.
- Web client: Next.js.
- Web development URL: `http://localhost:3000`.
- API development URL: `http://localhost:3001`; health endpoint previously documented as `/api/v1/health`.
- The web client uses a same-origin `/api` proxy to the API origin, defaulting to `http://localhost:3001`.
- The previously reported baseline was: web typecheck/lint passed, 11 web tests passed, production build passed, API typecheck passed, and 130 API tests passed. These are historical results, **not a guarantee that the current checkout still passes**. Re-run the checks after pulling the branch.

## Non-negotiable working rules

- Read repository-level `AGENTS.md` and the active source-of-truth documents in this documentation set before modifying code. `docs/LEAD_FOUNDATION_SPEC.md` has been intentionally retired; do not recreate or depend on it.
- Do not reset the database, run destructive Git commands, or overwrite existing work.
- Do not commit or push until the repository owner authorizes the specific operation.
- Do not expose secrets from environment files.
- Do not use Docker for the documented local workflow.
- Do not invent API contracts to fill gaps. Verify the implementation and tests; record unresolved contract decisions.
- A registered route does not prove that its full business workflow works end to end.
- Keep PatientNeed separate from the official BloodRequest entity and lifecycle.
