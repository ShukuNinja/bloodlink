# Web Page Flows and UI Requirements

## 1. Navigation model

Implement navigation according to authenticated role and available capabilities. Do not show a control as functional if its backend workflow is not implemented.

Suggested web information architecture:

- **Public:** landing page, authentication.
- **Individual:** hospital discovery, PatientNeed create, PatientNeed history/detail, supported donor profile and response views.
- **Hospital:** incoming PatientNeeds/review queue, PatientNeed review/detail, official BloodRequest management, responder/fulfilment views where supported.
- **Blood bank:** supported organization response/coordination views.
- **Shared:** account/session controls, loading/error states, access-denied/not-found handling.

The exact route paths should follow the current application’s route structure rather than being renamed as part of feature work without approval.

## 2. Authentication flow

1. User opens the app.
2. Unauthenticated users are sent to the authentication page for protected routes.
3. User submits credentials.
4. Client displays field validation and API errors using the shared error envelope.
5. On success, session/token handling follows the existing auth implementation.
6. Client navigates to the correct landing page for the authenticated user’s role.
7. Refresh, expired-session, logout, and unauthorized API responses are handled consistently.

Acceptance: protected data is not briefly exposed before auth checks; refresh does not create duplicate submissions; errors are actionable and do not leak secrets.

## 3. Hospital discovery and subscription flow

### Hospital list row/card

Each eligible hospital in the list must show:

- Hospital name and approved public details.
- Location/distance only to the extent returned and permitted by the API.
- A **Subscribe** or **Unsubscribe** button positioned next to the hospital name (or in the same clearly associated row/card).
- A loading state for the subscription action.
- A clear error state if the action fails.
- A visible subscribed state that is based on backend-confirmed subscription data.

### Subscribe interaction

1. Individual opens the hospital list.
2. The client loads eligible hospitals and the current user’s subscription state.
3. Each hospital row renders `Subscribe` if the user is not subscribed, otherwise `Unsubscribe` (or a clearly labeled subscribed-state control).
4. User clicks **Subscribe** for a specific hospital.
5. Disable that row’s action while the request is in flight; do not block actions on every other hospital unless the design requires it.
6. Call `POST /api/v1/hospitals/:id/subscription` through the same-origin `/api` client.
7. On success, update that hospital’s state from the server response or invalidate/refetch the relevant query.
8. Show a concise confirmation such as “Subscribed to [hospital name].”
9. The subscription persists after page refresh and re-login because the server is the source of truth.

### Unsubscribe interaction

1. User clicks **Unsubscribe** on a subscribed hospital.
2. Show a confirmation dialog only if product UX or the risk of accidental unsubscribe justifies it; do not add unnecessary friction by default.
3. Call `DELETE /api/v1/hospitals/:id/subscription`.
4. On success, update the UI from the server-confirmed state.
5. On failure, retain the previous confirmed state and show an error. Never leave the UI claiming the user is subscribed if the operation failed, or vice versa.

### Subscription error and edge states

Handle at least:

- Not authenticated / expired session.
- Hospital not found or not eligible.
- Duplicate subscribe request / already subscribed.
- Unsubscribe when no active subscription exists.
- Network timeout or server error.
- Rapid repeated clicks.
- Hospital list refresh while a mutation is in progress.
- Empty hospital list.
- Existing subscriptions loaded after the list.
- API returns success but the list query is stale.

Prefer idempotent UI behavior. Reconcile from server state after ambiguous failures rather than assuming the mutation failed or succeeded.

### What subscribing means

Subscription means the individual opts in to follow blood requests posted by that hospital. It does **not** automatically:

- accept any blood request;
- confirm donor eligibility;
- create a donation record;
- open an unrestricted conversation;
- bypass request-specific consent or two-way acceptance rules.

### Notification behavior

The user-facing intent is to know about blood requests posted by subscribed hospitals. Verify the current backend event, notification delivery, and preferences implementation before promising real-time push delivery. If only in-app state or a notification record is implemented, describe that accurately. The page should make it clear what notification channel is supported; do not invent email/SMS/push guarantees.

### Subscription visibility

- A user should be able to tell which hospitals they follow directly from the hospital list.
- If a dedicated “My subscriptions” view is implemented, it should reuse the same source of truth and offer navigation to each hospital.
- Do not build a second independent subscription store in the web client.
- Do not allow one user to inspect another user’s private subscription list unless an approved contract explicitly allows it.

## 4. PatientNeed flow — individual

1. Individual opens hospital discovery and chooses the hospital where the patient is admitted.
2. Individual enters the required PatientNeed fields, timing, and optional notes according to the actual schema.
3. Client validates required fields and submits once.
4. API creates a PatientNeed associated with the authenticated individual and selected hospital.
5. UI shows a confirmation and link to the submitted record.
6. Individual can inspect their own history and status.
7. Individual can cancel only where the backend permits it; UI must not pretend cancellation succeeded before server confirmation.
8. Hospital review and official BloodRequest creation remain separate steps.

Do not expose an action that lets an individual create an official BloodRequest directly.

## 5. PatientNeed review — hospital

1. Hospital user opens the incoming PatientNeed queue.
2. Queue supports loading, empty, error, and pagination states according to the backend contract.
3. Hospital opens a PatientNeed detail page.
4. Hospital reviews the information and chooses a supported action: verify/accept for processing or reject with any required reason.
5. On verification, the hospital creates the official BloodRequest using the supported API workflow.
6. UI displays the official request and its lifecycle state.
7. On rejection, the PatientNeed state and reason shown must match the server response.

Never implement a client-side status transition that bypasses the backend.

## 6. Official BloodRequest flow — hospital

- List and filter requests only by supported query parameters.
- Show current status and supported lifecycle actions.
- Prevent actions that are invalid for the current state.
- Confirm destructive or consequential transitions where appropriate.
- Reconcile after mutations using the server response/refetch.
- ResponderAssignment changes are owned by D3.
- DonationRecord/fulfilment semantics must follow the approved cross-module contract; do not infer that a response or assignment automatically proves donation completion.

## 7. Donor and organization response flows

- Show request context and the acting organization/individual identity permitted by the API.
- Require explicit user action for response/acceptance.
- Enforce two-way acceptance wherever the contract requires it.
- Keep conversations request-scoped and participant-authorized.
- Do not allow arbitrary direct messaging between individuals.
- Distinguish response submitted, accepted, confirmed, and fulfilled states if the API defines them separately.
- Avoid showing precise donor location.

## 8. Shared UX requirements

Every data-driven page must have:

- Initial loading state.
- Empty state with a useful next action.
- Recoverable error state with retry where appropriate.
- Field-level validation.
- Pending state that prevents duplicate mutations.
- Success feedback only after confirmed API success.
- Responsive layout and keyboard-accessible controls.
- Accessible labels, focus states, and dialogs.
- No hardcoded success data presented as real backend state.
