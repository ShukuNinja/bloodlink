# Final integration work tracker

Updated: 2026-10-26

For the ordered end-to-end completion plan and reusable ChatGPT handoff prompt, see [PROJECT_COMPLETION_GUIDE.md](./PROJECT_COMPLETION_GUIDE.md).

## Completed in this branch

- [x] Prevent donor and blood-centre response withdrawal after the request leaves active coordination.
- [x] Hide the blood-centre withdrawal action after the request locks.
- [x] Block request-scoped chat after fulfillment/cancellation and hide it on the hospital request page.
- [x] Add role-aware messaging that explains the request participant rules.
- [x] Add a patient-need conversation boundary for the submitting individual and its hospital; keep it separate from responder chat and close it when the related BloodRequest closes.
- [x] Add general hospital-to-blood-centre conversation persistence and API authorization.
- [x] Add active organization search for hospitals and blood banks.
- [x] Generalize subscriptions from individual-to-hospital to authenticated-user-to-hospital/blood-bank and preserve existing hospital subscription rows.
- [x] Add organization search, subscribe/unsubscribe, subscription list, conversation page, and top-level navigation in the web client.
- [x] Add separate hospital navigation links for patient needs and blood requests.

## Remaining

- [x] Allow all authenticated roles to access notifications; organization members and admins see open requests from hospitals they subscribe to, while individual accounts retain the existing open-request feed. Add notification access in web and mobile clients.
- [x] Add mobile organization search, subscribe/unsubscribe, subscription list, organization and patient-need conversations, and home-screen links.
- [ ] Add coverage for new search, subscription, organization conversation, and patient-need conversation workflows. Web tests pass (29); latest focused API notification tests pass (3). API build/typecheck and mobile/web typechecks pass. Full API loopback integration suite is blocked because sandbox network policy denies local listener connections.
- [ ] Verify the new migration against a disposable PostgreSQL database before applying it to a shared database; no local/disposable database was available.
- [ ] Provision Supabase later and validate migrations/PostGIS using the pooled runtime connection; retain direct connectivity for migration/admin tooling as needed.
- [ ] Configure Render web and API services and EAS Android/iOS test builds after end-to-end client validation; deployment credentials/project setup are not available in this workspace.
- [ ] Revisit requests from blood banks for notifications: current BloodRequests are created by hospitals; blood banks respond to them.
