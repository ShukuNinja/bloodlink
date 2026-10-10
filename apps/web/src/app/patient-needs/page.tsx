'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  formatTimestamp,
  statusBadgeClass,
} from '@/features/individual/patient-needs/present';
import { usePatientNeedHistory } from '@/features/individual/patient-needs/hooks';

const PAGE_SIZE = 10;

export default function PatientNeedsHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = usePatientNeedHistory(
    page,
    PAGE_SIZE,
  );

  return (
    <main>
      <div className="row">
        <h1>My patient needs</h1>
        <Link className="muted" href="/patient-needs/new">
          + New request
        </Link>
      </div>

      {error ? (
        error.isUnauthorized ? (
          <div className="alert error">
            You need to <Link href="/auth">sign in</Link> to see your history.
          </div>
        ) : (
          <div className="alert error">
            {error.message} <button onClick={() => void reload()}>Retry</button>
          </div>
        )
      ) : null}

      {loading ? <p className="muted">Loading history…</p> : null}

      {!loading && data && data.data.length === 0 ? (
        <div className="card">
          <p>No patient needs yet.</p>
          <Link href="/hospitals">Find a hospital and submit one</Link>
        </div>
      ) : null}

      {data && data.data.length > 0 ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Blood</th>
                <th>Component</th>
                <th>Units</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((record) => (
                <tr key={record.id}>
                  <td className="muted">{formatTimestamp(record.createdAt)}</td>
                  <td>{BLOOD_GROUP_LABELS[record.bloodGroup]}</td>
                  <td>{COMPONENT_LABELS[record.component]}</td>
                  <td>{record.units}</td>
                  <td>
                    <span className={statusBadgeClass(record.status)}>
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td>
                    <Link href={`/patient-needs/${record.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="muted">
              Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} ·{' '}
              {data.meta.total} total
            </span>
            <button
              disabled={page >= data.meta.totalPages || loading}
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
