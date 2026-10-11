'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  BloodRequestListQuery,
  BloodRequestRecord,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
} from '@/features/individual/patient-needs/present';
import { hospitalApi } from '../api';

const statuses: Array<NonNullable<BloodRequestListQuery['status']> | ''> = [
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

export default function HospitalBloodRequestsPage() {
  const [status, setStatus] = useState<BloodRequestListQuery['status']>();
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<BloodRequestRecord[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.listBloodRequests({
        status,
        page,
        pageSize: 20,
      });
      setRequests(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(
              0,
              'MALFORMED',
              'Could not load blood requests.',
            ),
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <div className="row">
        <h1>Official BloodRequests</h1>
        <Link href="/hospital/patient-needs">PatientNeed review queue</Link>
      </div>
      <p className="muted">
        These requests are created through hospital verification of a
        PatientNeed.
      </p>
      <div className="field">
        <label htmlFor="request-status">Filter by status</label>
        <select
          id="request-status"
          value={status ?? ''}
          onChange={(event) => {
            setStatus(
              (event.target.value ||
                undefined) as BloodRequestListQuery['status'],
            );
            setPage(1);
          }}
        >
          {statuses.map((value) => (
            <option key={value || 'all'} value={value}>
              {value || 'All statuses'}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error.isUnauthorized
            ? 'Sign in to access hospital requests.'
            : error.status === 403
              ? 'Your account does not have an active hospital membership for this workspace.'
              : error.message}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="muted" aria-live="polite">
          Loading BloodRequests…
        </p>
      ) : null}
      {!loading && !error && requests.length === 0 ? (
        <div className="card">
          <p>No BloodRequests match this filter.</p>
        </div>
      ) : null}
      {!loading && requests.length > 0 ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Blood</th>
                <th>Component</th>
                <th>Units</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{formatTimestamp(request.createdAt)}</td>
                  <td>{BLOOD_GROUP_LABELS[request.bloodGroup]}</td>
                  <td>{COMPONENT_LABELS[request.component]}</td>
                  <td>{request.unitsRequired}</td>
                  <td>{URGENCY_LABELS[request.urgency]}</td>
                  <td>{request.status.replaceAll('_', ' ')}</td>
                  <td>
                    <Link href={`/hospital/blood-requests/${request.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="muted">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
