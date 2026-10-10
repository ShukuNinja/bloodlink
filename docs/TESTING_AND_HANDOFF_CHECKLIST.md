# Testing and Final Handoff Checklist

## 1. Implementation status awareness

Read [`IMPLEMENTATION_STATUS_AND_HANDOFF.md`](IMPLEMENTATION_STATUS_AND_HANDOFF.md) before assigning work. In particular, the donor-profile, hospital-subscriptions, and donor-responses repositories intentionally throw `NotImplementedException`; they are scaffolds for D4, not completed workflows. The nearby-hospital repository has a real PostGIS query, but its API-level validation and end-to-end behavior still require verification.

## 2. Quality gates

Run:

```powershell
pnpm --filter @bloodlink/web typecheck
pnpm --filter @bloodlink/web lint
pnpm --filter @bloodlink/web test
pnpm --filter @bloodlink/web build

pnpm --filter @bloodlink/api typecheck
pnpm --filter @bloodlink/api test
```

Record command, result, and any pre-existing failure. Do not report a gate as passing unless it was actually run on the candidate commit.

## 3. Subscription test matrix

| Scenario | Expected result |
|---|---|
| Unsubscribed user views hospital list | Subscribe action is shown |
| Subscribed user views hospital list | Subscribed state/Unsubscribe action is shown |
| Subscribe succeeds | UI reflects server-confirmed subscribed state |
| Subscribe fails | Previous state remains; actionable error is shown |
| Rapid repeated click | Duplicate in-flight requests are prevented or safely handled |
| Refresh after subscribe | Subscription remains visible |
| Unsubscribe succeeds | UI reflects server-confirmed unsubscribed state |
| Unsubscribe fails | UI does not falsely show unsubscribed state |
| Unauthenticated mutation | API rejects it; client handles session/auth state |
| User targets ineligible/nonexistent hospital | API error is surfaced safely |
| Hospital posts a BloodRequest | The actual implemented notification path is verified |
| Notification channel unavailable/not implemented | UI/docs do not promise delivery that does not exist |

## 4. PatientNeed and BloodRequest tests

- Individual can create and read only their own PatientNeed.
- Individual cannot directly create an official BloodRequest.
- Hospital review actions enforce organization authorization.
- Verify/reject actions persist valid states.
- Official BloodRequest creation occurs through the hospital-owned workflow.
- Invalid lifecycle transitions are rejected server-side.
- D2 cannot mutate D3-owned BloodRequest/assignment state.
- D4 response handling cannot mutate D3-owned lifecycle/assignment state.
- Cancellation and concurrent mutations do not produce inconsistent state.
- Fulfillment state follows the approved DonationRecord contract.

## 5. Security and privacy tests

- Cross-user PatientNeed access is rejected.
- Organization membership is enforced.
- Unauthorized request participants cannot access conversations.
- No direct individual-to-individual chat/request path is exposed.
- Precise donor location is not present in ordinary user-facing projections.
- Secrets and tokens are absent from logs and committed files.
- Invalid UUIDs, malformed payloads, and unsupported state transitions return the expected error envelope.

## 6. Manual browser walkthrough

Use approved test accounts and non-production data.

1. Sign in as an individual.
2. Open hospital discovery.
3. Subscribe to one hospital.
4. Verify its state changes and remains correct after refresh.
5. Unsubscribe and verify the state again.
6. If request notifications are implemented, have that hospital post a test BloodRequest and verify the supported delivery channel.
7. Create a PatientNeed linked to the appropriate hospital.
8. Sign in as that hospital and review the PatientNeed.
9. Verify or reject it through the UI.
10. If verified, confirm the official BloodRequest exists separately and follow its supported lifecycle.
11. Exercise supported donor/organization responses and acceptance.
12. Repeat critical actions with a user lacking permission and verify safe rejection.

## 7. Final developer report

Provide:
- Summary of completed vertical slices.
- Routes/pages implemented.
- API endpoints integrated and any unimplemented endpoints.
- Contract decisions resolved and those still awaiting owner approval.
- Migrations or seed steps used, with database target stated (never disclose credentials).
- Quality-gate results.
- Manual E2E scenarios run and outcomes.
- Known defects and limitations.
- Exact changed-file list.
- Git branch and commit hash.
- Confirmation that no secrets, generated snapshots, or unrelated artifacts were included.

Do not commit or push unless the repository owner explicitly authorizes it.
