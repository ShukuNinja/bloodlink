'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import type { PatientNeedRecord } from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
  statusBadgeClass,
} from '@/features/individual/patient-needs/present';
import { hospitalApi } from '../../api';
import { PatientNeedConversationPanel } from '@/features/communication/patient-need-conversation-panel';

export default function HospitalPatientNeedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [record, setRecord] = useState<PatientNeedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getPatientNeed(id);
      setRecord(response.data);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(
              0,
              'MALFORMED',
              'Could not load this patient need.',
            ),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(action: 'verify' | 'reject') {
    if (action === 'reject' && !window.confirm('Reject this patient need?'))
      return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action === 'verify') {
        const response = await hospitalApi.verifyPatientNeed(id);
        setRecord(response.data.patientNeed);
        setCreatedRequestId(response.data.bloodRequest.id);
        setNotice('Verified. An official BloodRequest was created.');
      } else {
        const response = await hospitalApi.rejectPatientNeed(id);
        setRecord(response.data);
        setNotice('Patient need rejected.');
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(0, 'MALFORMED', 'The review action failed.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <p>
        <Link href="/hospital/patient-needs">← Back to review queue</Link>
      </p>
      <h1>Review patient need</h1>
      {loading ? (
        <p className="muted" aria-live="polite">
          Loading…
        </p>
      ) : null}
      {error ? (
        <div className="alert error" role="alert">
          {error.isUnauthorized
            ? 'Sign in to access hospital review.'
            : error.status === 403
              ? 'Your account does not have an active hospital membership for this workspace.'
              : error.status === 404
                ? 'This patient need is not available to your hospital membership.'
                : error.status === 409
                  ? 'This patient need was already reviewed. Refresh to see its current state.'
                  : error.message}{' '}
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}
      {createdRequestId ? (
        <p>
          <Link href={`/hospital/blood-requests/${createdRequestId}`}>
            Open the official BloodRequest
          </Link>
        </p>
      ) : null}
      {record ? (
        <div className="card">
          <p>
            <span className={statusBadgeClass(record.status)}>
              {STATUS_LABELS[record.status]}
            </span>
          </p>
          <table className="table">
            <tbody>
              <tr>
                <th>Hospital</th>
                <td>{record.hospitalId}</td>
              </tr>
              <tr>
                <th>Blood group</th>
                <td>{BLOOD_GROUP_LABELS[record.bloodGroup]}</td>
              </tr>
              <tr>
                <th>Component</th>
                <td>{COMPONENT_LABELS[record.component]}</td>
              </tr>
              <tr>
                <th>Units</th>
                <td>{record.units}</td>
              </tr>
              <tr>
                <th>Urgency</th>
                <td>{URGENCY_LABELS[record.urgency]}</td>
              </tr>
              <tr>
                <th>Required by</th>
                <td>{formatTimestamp(record.requiredBy)}</td>
              </tr>
              <tr>
                <th>Submitted</th>
                <td>{formatTimestamp(record.createdAt)}</td>
              </tr>
              <tr>
                <th>Coordination notes</th>
                <td>{record.additionalNotes}</td>
              </tr>
            </tbody>
          </table>
          {record.status === 'PENDING_HOSPITAL_REVIEW' ? (
            <div className="row" style={{ marginTop: 16 }}>
              <button
                className="primary"
                type="button"
                disabled={saving}
                onClick={() => void review('verify')}
              >
                {saving ? 'Saving…' : 'Verify and create BloodRequest'}
              </button>
              <button
                className="danger"
                type="button"
                disabled={saving}
                onClick={() => void review('reject')}
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {record?.status === 'VERIFIED' ? (
        <PatientNeedConversationPanel patientNeedId={id} />
      ) : null}
    </main>
  );
}
