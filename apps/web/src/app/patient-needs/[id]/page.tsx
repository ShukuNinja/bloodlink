'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
  statusBadgeClass,
} from '@/features/individual/patient-needs/present';
import {
  useCancelPatientNeed,
  usePatientNeed,
} from '@/features/individual/patient-needs/hooks';
import { PatientNeedConversationPanel } from '@/features/communication/patient-need-conversation-panel';

export default function PatientNeedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { record, loading, error, reload } = usePatientNeed(id);
  const {
    cancelling,
    cancelled,
    error: cancelError,
    cancel,
  } = useCancelPatientNeed();
  const [confirming, setConfirming] = useState(false);

  const displayed = cancelled ?? record;

  async function handleCancel() {
    const updated = await cancel(id);
    setConfirming(false);
    if (updated) {
      // Ensure the canonical read reflects the cancelled state.
      await reload();
    }
  }

  return (
    <main>
      <p>
        <Link href="/patient-needs">← Back to history</Link>
      </p>
      <h1>Patient need</h1>

      {loading ? <p className="muted">Loading…</p> : null}

      {error ? (
        error.isUnauthorized ? (
          <div className="alert error">
            You need to <Link href="/auth">sign in</Link> to view this request.
          </div>
        ) : error.status === 404 ? (
          <div className="alert error">
            This patient need does not exist or does not belong to your account.
          </div>
        ) : (
          <div className="alert error">
            {error.message} <button onClick={() => void reload()}>Retry</button>
          </div>
        )
      ) : null}

      {displayed ? (
        <div className="card">
          <p>
            <span className={statusBadgeClass(displayed.status)}>
              {STATUS_LABELS[displayed.status]}
            </span>
          </p>
          <table className="table">
            <tbody>
              <tr>
                <th>Patient name</th>
                <td>{displayed.patientName || 'Not provided'}</td>
              </tr>
              <tr>
                <th>Blood group</th>
                <td>{BLOOD_GROUP_LABELS[displayed.bloodGroup]}</td>
              </tr>
              <tr>
                <th>Component</th>
                <td>{COMPONENT_LABELS[displayed.component]}</td>
              </tr>
              <tr>
                <th>Units</th>
                <td>{displayed.units}</td>
              </tr>
              <tr>
                <th>Urgency</th>
                <td>{URGENCY_LABELS[displayed.urgency]}</td>
              </tr>
              <tr>
                <th>Required by</th>
                <td>{formatTimestamp(displayed.requiredBy)}</td>
              </tr>
              <tr>
                <th>Submitted</th>
                <td>{formatTimestamp(displayed.createdAt)}</td>
              </tr>
              <tr>
                <th>Notes</th>
                <td>{displayed.additionalNotes}</td>
              </tr>
            </tbody>
          </table>

          {cancelled ? (
            <div className="alert success">
              This patient need has been cancelled.
            </div>
          ) : null}

          {cancelError ? (
            <div className="alert error">
              {cancelError.status === 409
                ? 'This request can no longer be cancelled. Refresh to see its current state.'
                : cancelError.message}{' '}
              <button onClick={() => void reload()}>Refresh</button>
            </div>
          ) : null}

          {!cancelled && record?.status === 'PENDING_HOSPITAL_REVIEW' ? (
            confirming ? (
              <div className="row" style={{ marginTop: 12 }}>
                <span className="muted">Cancel this patient need?</span>
                <button
                  className="danger"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel request'}
                </button>
                <button
                  disabled={cancelling}
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                className="danger"
                style={{ marginTop: 12 }}
                onClick={() => setConfirming(true)}
              >
                Cancel this patient need
              </button>
            )
          ) : null}
        </div>
      ) : null}
      {record?.status === 'VERIFIED' ? (
        <PatientNeedConversationPanel patientNeedId={id} />
      ) : null}
    </main>
  );
}
