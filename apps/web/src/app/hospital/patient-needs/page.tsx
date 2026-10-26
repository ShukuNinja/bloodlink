'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  HospitalPatientNeedQuery,
  PatientNeedRecord,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  formatTimestamp,
  statusBadgeClass,
} from '@/features/individual/patient-needs/present';
import { hospitalApi } from '../api';

const PAGE_SIZE = 20;
const statuses: Array<NonNullable<HospitalPatientNeedQuery['status']> | ''> = [
  '',
  'PENDING_HOSPITAL_REVIEW',
  'VERIFIED',
  'REJECTED',
  'CANCELLED',
];

export default function HospitalPatientNeedsPage() {
  const [status, setStatus] = useState<HospitalPatientNeedQuery['status']>();
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<PatientNeedRecord[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.listPatientNeeds({
        status,
        page,
        pageSize: PAGE_SIZE,
      });
      setRecords(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(0, 'MALFORMED', 'Could not load patient needs.'),
      );
      setRecords([]);
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
        <h1>Hospital patient needs</h1>
        <Link href="/hospital/blood-requests">Official blood requests</Link>
      </div>
      <p className="muted">
        Review PatientNeed handoffs submitted to your active hospital
        memberships.
      </p>

      <div className="field">
        <label htmlFor="need-status">Filter by status</label>
        <select
          id="need-status"
          value={status ?? ''}
          onChange={(event) => {
            setStatus(
              event.target.value
                ? (event.target.value as HospitalPatientNeedQuery['status'])
                : undefined,
            );
            setPage(1);
          }}
        >
          {statuses.map((value) => (
            <option key={value || 'all'} value={value}>
              {value ? STATUS_LABELS[value] : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="alert error" role="alert">
          {error.isUnauthorized
            ? 'Sign in to access hospital review.'
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
          Loading patient needs…
        </p>
      ) : null}
      {!loading && !error && records.length === 0 ? (
        <div className="card">
          <p>No patient needs match this filter.</p>
        </div>
      ) : null}
      {!loading && records.length > 0 ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Patient</th>
                <th>Blood group</th>
                <th>Component</th>
                <th>Units</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatTimestamp(record.createdAt)}</td>
                  <td>{record.patientName || 'Not provided'}</td>
                  <td>{BLOOD_GROUP_LABELS[record.bloodGroup]}</td>
                  <td>{COMPONENT_LABELS[record.component]}</td>
                  <td>{record.units}</td>
                  <td>
                    <span className={statusBadgeClass(record.status)}>
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td>
                    <Link href={`/hospital/patient-needs/${record.id}`}>
                      Review
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
