# Current product scope and domain rules

Updated: 2026-10-26

## Product goal

BloodLink coordinates hospital-verified blood requests with participating
blood banks and individuals who may volunteer. Hospitals remain responsible
for validating patient needs and operating official blood requests.

## Supported roles and capabilities

- **Individual:** find hospitals/blood banks, subscribe to organizations,
  submit and track a PatientNeed, use its hospital conversation after
  verification, review open blood requests, and volunteer through supported
  response flows.
- **Hospital member:** manage organization workspaces, review PatientNeeds,
  create/manage BloodRequests, converse with a Blood Centre, subscribe to
  hospitals/blood banks, and receive subscribed-hospital request alerts.
- **Blood Centre member:** respond to hospital BloodRequests, converse with
  hospitals, subscribe to hospitals/blood banks, and receive subscribed-
  hospital request alerts.
- **Admin:** use explicitly implemented admin capabilities and can subscribe
  to eligible organizations; Admin is not an implicit authorization bypass.

## Current approved communication rules

- General conversations between a hospital and blood bank are allowed.
- An individual may contact a hospital through the conversation for a verified
  PatientNeed and the official BloodRequest created from it.
- Hospitals and blood banks cannot initiate direct contact with individuals.
- Request conversations/actions are unavailable after the request reaches a
  terminal fulfillment/cancellation state.
- No individual-to-individual or unrestricted social chat is in scope.

## Subscriptions and alerts

- Any authenticated user may subscribe to active hospitals and blood banks.
- Individuals cannot be subscribed to.
- The notification feed is available to every authenticated role.
- Individual accounts retain the existing open-request feed; organization
  members/Admins receive open requests from hospitals they subscribe to.
- Alerts are currently derived in-app data. No persistent notification/read
  history or push/email/SMS delivery is claimed.

## Product constraints

- Current BloodRequests are created by hospitals; blood banks respond.
- BloodLink does not conduct screening, testing, crossmatching, collection,
  processing, storage, issue, or transfusion.
- Do not expose precise donor location.
- Do not treat a PatientNeed as a BloodRequest or a subscription as consent to
  respond, donate, reserve a donor, or start unrestricted conversation.

The scope is summarized from current code plus explicit user clarifications.
For verified implementation detail and unresolved work, see
[current implementation status](../project/current-implementation-status.md).
