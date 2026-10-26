'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  BloodRequestListQuery,
  BloodRequestRecord,
  OrganizationResponse,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
} from '@/features/individual/patient-needs/present';
import { bloodCentreApi } from './api';

const statusOptions: Array<NonNullable<BloodRequestListQuery['status']> | ''> =
  [
    '',
    'OPEN',
    'RESPONSES_RECEIVED',
    'COVERED',
    'COORDINATING',
    'BACKUP_REQUIRED',
    'FULFILLMENT_PENDING',
    'FULFILLMENT_CONFIRMED',
    'FULFILLED',
    'CANCELLED',
  ];

export default function BloodCentreWorkspacePage() {
  const [status, setStatus] = useState<BloodRequestListQuery['status']>();
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<BloodRequestRecord[]>([]);
  const [responses, setResponses] = useState<OrganizationResponse[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [requestResult, responseResult] = await Promise.all([
        bloodCentreApi.listRequests({ status, page, pageSize: 20 }),
        bloodCentreApi.listResponses(),
      ]);
      setRequests(requestResult.data);
      setTotalPages(requestResult.meta.totalPages);
      setResponses(responseResult.data);
    } catch (cause) {
      setLoadError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load blood requests.',
      );
      setRequests([]);
      setResponses([]);
    } finally {
      setLoading(false);
    }
  }, [page, retry, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(request: BloodRequestRecord) {
    setBusyIds((current) => new Set(current).add(request.id));
    setActionError(null);
    setNotice(null);
    try {
      const result = await bloodCentreApi.respond(request.id);
      setResponses((current) => [
        result.data,
        ...current.filter((response) => response.id !== result.data.id),
      ]);
      setNotice(`Response recorded with status ${result.data.status}.`);
    } catch (cause) {
      setActionError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not submit the response.',
      );
      setRetry((value) => value + 1);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
    }
  }

  async function withdraw(request: BloodRequestRecord) {
    setBusyIds((current) => new Set(current).add(request.id));
    setActionError(null);
    setNotice(null);
    try {
      const result = await bloodCentreApi.withdraw(request.id);
      setResponses((current) => [
        result.data,
        ...current.filter((response) => response.id !== result.data.id),
      ]);
      setNotice(`Response updated to ${result.data.status}.`);
    } catch (cause) {
      setActionError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not withdraw the response.',
      );
      setRetry((value) => value + 1);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(request.id);
        return next;
      });
    }
  }

  return (
    <main>
      <h1>Blood bank workspace</h1>
      <p className="muted">
        Review official requests and explicitly submit a coordination response.
        BloodLink does not manage blood inventory or medical eligibility.
      </p>
      <div className="field">
        <label htmlFor="centre-request-status">Filter by status</label>
        <select
          id="centre-request-status"
          value={status ?? ''}
          onChange={(event) => {
            setStatus(
              (event.target.value ||
                undefined) as BloodRequestListQuery['status'],
            );
            setPage(1);
          }}
        >
          {statusOptions.map((value) => (
            <option key={value || 'all'} value={value}>
              {value || 'All active requests'}
            </option>
          ))}
        </select>
      </div>
      {loadError ? (
        <div className="alert error" role="alert">
          {loadError}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="alert error" role="alert">
          {actionError} A status refresh was requested.
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}
      {loading ? <p aria-live="polite">Loading blood requests…</p> : null}
      {!loading && !loadError && requests.length === 0 ? (
        <div className="card">
          <p>No blood requests match this filter.</p>
        </div>
      ) : null}
      {!loading && requests.length > 0 ? (
        <section className="card" aria-label="Blood requests">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Required by</th>
                  <th>Blood group</th>
                  <th>Component</th>
                  <th>Units</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Your response</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{formatTimestamp(request.requiredBy)}</td>
                    <td>{BLOOD_GROUP_LABELS[request.bloodGroup]}</td>
                    <td>{COMPONENT_LABELS[request.component]}</td>
                    <td>{request.unitsRequired}</td>
                    <td>{URGENCY_LABELS[request.urgency]}</td>
                    <td>{request.status.replaceAll('_', ' ')}</td>
                    <td>
                      {responseFor(responses, request.id)?.status ??
                        'No response'}
                    </td>
                    <td>
                      {responseFor(responses, request.id)?.status ===
                        'ACCEPTED' && isOpen(request.status) ? (
                        <button
                          type="button"
                          disabled={loading || busyIds.has(request.id)}
                          onClick={() => void withdraw(request)}
                        >
                          {busyIds.has(request.id) ? 'Updating…' : 'Withdraw'}
                        </button>
                      ) : responseFor(responses, request.id)?.status ===
                        'ACCEPTED' ? (
                        <span className="muted">Response locked</span>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            loading ||
                            busyIds.has(request.id) ||
                            !isOpen(request.status)
                          }
                          onClick={() => void respond(request)}
                        >
                          {busyIds.has(request.id) ? 'Submitting…' : 'Respond'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span className="muted">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
      <section className="card" aria-labelledby="centre-responses-heading">
        <h2 id="centre-responses-heading">My organization responses</h2>
        {responses.length === 0 ? (
          <p className="muted">This centre has not responded to a request.</p>
        ) : (
          <ul>
            {responses.map((response) => (
              <li key={response.id}>
                Request {response.bloodRequestId} — {response.status} — updated{' '}
                {formatTimestamp(response.updatedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function isOpen(status: BloodRequestRecord['status']) {
  return [
    'OPEN',
    'RESPONSES_RECEIVED',
    'COVERED',
    'COORDINATING',
    'BACKUP_REQUIRED',
  ].includes(status);
}

function responseFor(responses: OrganizationResponse[], requestId: string) {
  return responses.find((response) => response.bloodRequestId === requestId);
}
