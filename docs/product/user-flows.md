# Current role-based user flows

Updated: 2026-10-26

This document records the intended/current navigation at a high level. The
registered routes and server authorization in source remain authoritative.

## Shared navigation

Authenticated users can find hospitals and blood banks, open Conversations,
open Subscriptions, and view Notifications. Conversation and notification
access is still scoped by the API to the account's authorized records.

## Individual

1. Search/find hospitals and blood banks.
2. Subscribe/unsubscribe to an organization and inspect subscribed
   organizations.
3. Submit and track a PatientNeed.
4. After hospital verification creates a BloodRequest, use its private
   hospital conversation. The chat closes with the related request.
5. Review open BloodRequests and use the supported volunteer response flow.
6. Review current request alerts.

## Hospital

1. Open Patient needs and Blood requests from separate navigation entries.
2. Review and verify/reject a PatientNeed using supported API transitions.
3. A verified need may result in a distinct official BloodRequest.
4. Use the private submitter conversation and general hospital–blood-bank
   Conversations where authorized.
5. Manage responders and fulfillment through D3-owned operations.

## Blood Centre

1. Use the Blood Centre workspace to review and respond to hospital requests.
2. Search organizations, subscribe/unsubscribe, and view Conversations,
   Subscriptions, and Notifications.
3. Use general hospital–blood-bank conversation outside a request when wanted.
4. Do not show withdrawal after the request leaves active coordination.

## Completion QA

Exercise each route with separate Individual, Hospital, Blood Centre, and
Admin test accounts. Include unauthorized access, another user's resource,
loading/empty/error states, request fulfillment, reload, and mobile app restart.
See [the release checklist](../quality/verification-and-release-checklist.md).
