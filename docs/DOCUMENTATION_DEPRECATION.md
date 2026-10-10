# Documentation Deprecation and Migration Plan

## Objective

Retire the old documentation set as the active source of truth and replace it with the structured documentation listed in `README.md`. Preserve historical information where useful, but clearly label it as superseded. Do not discard useful implementation evidence silently.

## Important distinction

“Deprecated” means the document must no longer be treated as current guidance. It does **not** automatically mean delete the file. Use a controlled archive so decisions and audit evidence remain recoverable.

## Proposed procedure

1. Inventory tracked Markdown and text documentation under `docs/`, plus repository-root developer guides.
2. Identify normative documents that must remain active (for example, `AGENTS.md`, security rules, and the lead foundation specification). Do not move or overwrite these until the owner explicitly decides how they are to be handled.
3. Create `docs/archive/deprecated/`.
4. Move superseded implementation notes, skeletons, old handoffs, and audits into that archive, preserving filenames and Git history where practical.
5. Add a short deprecation header to archived documents stating:
   - `Status: DEPRECATED — historical reference only`
   - date of deprecation;
   - replacement document(s);
   - whether unresolved decisions remain.
6. Add the new active documents from this documentation pack to `docs/`.
7. Update repository README links and any in-repository links that point to moved documents.
8. Search for stale references and check that the new docs do not contradict approved domain rules.
9. Review the complete diff before staging.

## Documents proposed as the new active set

- `docs/README.md`
- `docs/PRODUCT_SCOPE_AND_DOMAIN_RULES.md`
- `docs/WEB_PAGE_FLOWS.md`
- `docs/API_CONTRACTS_AND_MODULE_OWNERSHIP.md`
- `docs/LOCAL_DEVELOPMENT_RUNBOOK.md`
- `docs/IMPLEMENTATION_PLAN_AND_ACCEPTANCE.md`
- `docs/TESTING_AND_HANDOFF_CHECKLIST.md`
- `docs/DOCUMENTATION_DEPRECATION.md`

## Files requiring special treatment

- `AGENTS.md`: repository-level agent instructions are operational guardrails, not ordinary product documentation. Keep active unless the owner explicitly replaces them.
- Lead foundation specification: treat as a governance/source-of-truth artifact. Do not silently archive or contradict it.
- `CROSS_MODULE_CONTRACT_DECISIONS.md`: unresolved cross-module decisions may still be binding context. Migrate unresolved decisions into the new API contract document or archive with explicit cross-reference; do not lose them.
- Audit reports: archive rather than delete if they provide traceability.
- Generated snapshots such as `repomix-output.xml`: normally exclude from active docs and commits unless specifically required for reproducibility.
- SQL seed files: are not documentation. Review for safety and utility separately; do not delete as part of a blanket documentation move.

## Safety checks before finalizing

- Confirm no required instructions or unresolved decisions were lost.
- Confirm all internal links resolve.
- Confirm active docs agree on PatientNeed versus BloodRequest.
- Confirm hospital subscription UI and notification semantics are documented.
- Confirm local setup does not require Docker or destructive database commands.
- Confirm docs clearly distinguish verified behavior from proposed/remaining work.
