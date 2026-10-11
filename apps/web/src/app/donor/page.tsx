'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DonorBloodRequestSummary,
  DonorResponse,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  COMPONENT_LABELS,
  URGENCY_LABELS,
  BLOOD_GROUP_LABELS,
  formatTimestamp,
} from '@/features/individual/patient-needs/present';
import { donorApi } from './api';
import { CommunicationPanel } from '@/features/coordination/communication-panel';

export default function IndividualDonorPage() {
  const [requests, setRequests] = useState<DonorBloodRequestSummary[]>([]);
  const [responses, setResponses] = useState<DonorResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setResponsesError(null);
    try {
      const open = await donorApi.listRequests({ page: 1, pageSize: 100 });
      setRequests(open.data);
      try {
        const own = await donorApi.listResponses();
        setResponses(own.data);
      } catch (cause) {
        setResponsesError(
          cause instanceof ApiClientError
            ? cause.message
            : 'Could not load your response statuses.',
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load blood requests.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, retry]);

  async function respond(requestId: string, current?: DonorResponse) {
    setBusy(requestId);
    setError(null);
    try {
      const result =
        current?.status === 'ACCEPTED'
          ? await donorApi.withdraw(requestId)
          : await donorApi.accept(requestId);
      setResponses((rows) => [
        result.data,
        ...rows.filter((row) => row.bloodRequestId !== requestId),
      ]);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update your response.',
      );
      setRetry((value) => value + 1);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <h1>Open blood requests</h1>
      <p className="muted">
        Review requests and volunteer when you can help. The hospital verifies
        suitability and coordinates with selected responders.
      </p>
      {error ? (
        <div className="alert error" role="alert">
          {error}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : null}
      <section className="card" aria-label="Open requests">
        {requests.length === 0 ? (
          <p className="muted">There are no open blood requests right now.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Blood group</th>
                  <th>Component</th>
                  <th>Units</th>
                  <th>Urgency</th>
                  <th>Required by</th>
                  <th>Your response</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const response = responses.find(
                    (item) => item.bloodRequestId === request.id,
                  );
                  return (
                    <tr key={request.id}>
                      <td>{request.hospitalName}</td>
                      <td>{BLOOD_GROUP_LABELS[request.bloodGroup]}</td>
                      <td>{COMPONENT_LABELS[request.component]}</td>
                      <td>{request.unitsRequired}</td>
                      <td>{URGENCY_LABELS[request.urgency]}</td>
                      <td>{formatTimestamp(request.requiredBy)}</td>
                      <td>
                        <button
                          type="button"
                          disabled={busy === request.id}
                          onClick={() => void respond(request.id, response)}
                        >
                          {busy === request.id
                            ? 'Saving…'
                            : response?.status === 'ACCEPTED'
                              ? 'Withdraw'
                              : 'I can help'}
                        </button>
                        {response ? (
                          <span className="muted"> {response.status}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="responses-heading">
        <h2 id="responses-heading">My responses</h2>
        {responsesError ? (
          <p className="alert error" role="alert">
            {responsesError}
          </p>
        ) : null}
        {responses.length === 0 && !responsesError ? (
          <p className="muted">You have not responded to an open request.</p>
        ) : null}
        {responses.length > 0 ? (
          <ul>
            {responses.map((response) => (
              <li key={response.id}>
                Request {response.bloodRequestId} — {response.status} — updated{' '}
                {formatTimestamp(response.updatedAt)}
                {response.status === 'ACCEPTED' ? (
                  <CommunicationPanel requestId={response.bloodRequestId} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
