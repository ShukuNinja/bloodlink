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
- [x] Add coverage for organization and PatientNeed conversation membership, privacy, and terminal-state behavior. API suite passes 152/152; web suite passes 29/29.
- [x] Verify all 10 migrations on an isolated PostgreSQL 18 + PostGIS cluster. Prisma reports up to date; a seeded hospital subscription survived the rename to `OrganizationSubscription`.
- [ ] Create/configure Supabase staging and run migrations there. The plan now separates pooled runtime `DATABASE_URL` from Prisma CLI `DIRECT_URL`; isolated migration verification is complete.
- [ ] Configure Render web/API and EAS mobile builds after Supabase staging is ready. No Render or EAS account/project is configured yet.
- [x] Persist mobile access/refresh tokens with Expo SecureStore and restore/rotate the session across app restarts; unit tests cover persistence and refresh.
- [ ] Configure EAS and install the app on a physical device. Android/iOS Expo exports pass, but no installable EAS build or device test is complete.
- [ ] Revisit requests from blood banks for notifications: current BloodRequests are created by hospitals; blood banks respond to them.
