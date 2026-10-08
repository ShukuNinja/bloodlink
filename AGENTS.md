# BloodLink Agent Instructions

## Authority

The Lead Developer has final authority over architectural decisions,
shared infrastructure, cross-domain contracts, and integration decisions.

Feature developers own implementation within their assigned domain boundaries.

Read:

- `docs/LEAD_FOUNDATION_SPEC.md`

before making repository changes.

## Mission

Implement the BloodLink repository according to the specified architecture. During foundation work, prioritize scaffolding, contracts, shared infrastructure, consistency, and validation over feature completeness.

## Non-Negotiable Rules

1. Do not redesign the architecture unless explicitly instructed.
2. Do not invent domain entities without approval.
3. Do not change API contracts without approval.
4. Do not duplicate shared UI primitives.
5. Use the centralized design system.
6. Do not modify unrelated feature domains.
7. Do not introduce unnecessary dependencies.
8. Keep business logic out of foundation scaffolds unless explicitly requested.
9. Do not bypass the API from web or mobile clients.
10. Authorization must be enforced server-side.
11. Never expose precise donor location through ordinary user-facing responses.
12. Do not put medical screening or blood-bank operations into BloodLink business logic.
13. Run formatting, linting, typechecking, and relevant tests after changes.
14. If a requirement is ambiguous and affects architecture, stop and report the ambiguity rather than silently inventing a design.
15. Do not modify `docs/LEAD_FOUNDATION_SPEC.md` unless explicitly instructed by the Lead Developer.

## Ownership

D1: platform foundation, auth/RBAC, shared contracts, design system, integration.

D2: individual and PatientNeed.

D3: hospital and BloodRequest.

D4: donor, blood centre, matching, responses, notifications, communication, donation coordination.

## Shared Files

Treat the following as protected integration surfaces:

- Prisma schema and migrations
- shared contracts
- shared validation
- shared UI components
- design tokens
- auth/RBAC
- root configuration
- application shells
- package dependency configuration

Do not change these casually.

## Scaffold Convention

When creating a feature file for another developer, include a concise comment header containing:

- owner
- endpoint/method if applicable
- purpose
- input
- output
- authorization
- dependencies
- state changes
- explicit non-responsibilities

Create structure and contracts, but do not implement the feature unless explicitly requested.

## Validation

After meaningful changes:

1. format
2. lint
3. typecheck
4. run relevant tests
5. inspect the diff
6. report files changed and any remaining issues

## Change Discipline

Prefer small, coherent changes. Do not perform unrelated refactors while implementing a requested task.
