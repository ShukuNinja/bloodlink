'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import type {
  BloodRequestDetail,
  ResponderResponseReference,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
} from '@/features/individual/patient-needs/present';
import { hospitalApi } from '../../api';
import { CommunicationPanel } from '@/features/coordination/communication-panel';

export default function HospitalBloodRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [request, setRequest] = useState<BloodRequestDetail | null>(null);
  const [responses, setResponses] = useState<ResponderResponseReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyResponse, setBusyResponse] = useState<string | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, responseList] = await Promise.all([
        hospitalApi.getBloodRequest(id),
        hospitalApi.listResponses(id).catch((cause: unknown) => {
          setResponsesError(
            cause instanceof ApiClientError
              ? cause.message
              : 'Could not load responder details.',
          );
          return null;
        }),
      ]);
      setRequest(detail.data);
      if (responseList) {
        setResponses(responseList.data);
        setResponsesError(null);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(
              0,
              'MALFORMED',
              'Could not load this BloodRequest.',
            ),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function performAction(action: 'cancel' | 'start' | 'confirm') {
    const prompt =
      action === 'cancel'
        ? 'Cancel this BloodRequest?'
        : action === 'start'
          ? 'Start fulfillment for this BloodRequest?'
          : 'Confirm fulfillment for this BloodRequest?';
    if (!window.confirm(prompt)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action === 'cancel') await hospitalApi.cancelBloodRequest(id);
      else if (action === 'start') await hospitalApi.startFulfillment(id);
      else await hospitalApi.confirmFulfillment(id);
      setNotice('The action was accepted by the server.');
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(
              0,
              'MALFORMED',
              'The BloodRequest action failed.',
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function performAssignment(
    response: ResponderResponseReference,
    action: 'select' | 'standby' | 'release',
  ) {
    setBusyResponse(response.responseId);
    setError(null);
    setNotice(null);
    try {
      if (action === 'select') {
        await hospitalApi.selectResponder(id, response.responseId, {
          responseType: response.responseType,
        });
      } else if (action === 'standby') {
        await hospitalApi.standbyResponder(id, response.responseId, {
          responseType: response.responseType,
        });
      } else {
        await hospitalApi.releaseResponder(id, response.responseId, {
          responseType: response.responseType,
        });
      }
      setNotice(`Responder ${action} action completed.`);
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught
          : new ApiClientError(0, 'MALFORMED', 'Could not update responder.'),
      );
    } finally {
      setBusyResponse(null);
    }
  }

  const selectedAssignment = request?.assignments.find(
    (assignment) => assignment.state === 'SELECTED',
  );
  const selectedResponse = selectedAssignment
    ? responses.find(
        (response) =>
          response.responseId === selectedAssignment.response.responseId &&
          response.responseType === selectedAssignment.response.responseType,
      )
    : undefined;
  const canStartFulfillment = Boolean(
    request &&
    isPreFulfillment(request.status) &&
    selectedResponse?.status === 'ACCEPTED',
  );

  return (
    <main>
      <p>
        <Link href="/hospital/blood-requests">← Back to BloodRequests</Link>
      </p>
      <h1>BloodRequest coordination</h1>
      {loading ? (
        <p className="muted" aria-live="polite">
          Loading…
        </p>
      ) : null}
      {error ? (
        <div className="alert error" role="alert">
          {error.isUnauthorized
            ? 'Sign in to access hospital requests.'
            : error.status === 403
              ? 'Your account does not have an active hospital membership for this workspace.'
              : error.status === 404
                ? 'This request is not available to your hospital membership.'
                : error.status === 409
                  ? `${error.message} The server validates every lifecycle transition.`
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
      {request ? (
        <>
          <div className="card">
            <p>
              <strong>Status:</strong> {request.status.replaceAll('_', ' ')}
            </p>
            <table className="table">
              <tbody>
                <tr>
                  <th>Blood group</th>
                  <td>{BLOOD_GROUP_LABELS[request.bloodGroup]}</td>
                </tr>
                <tr>
                  <th>Component</th>
                  <td>{COMPONENT_LABELS[request.component]}</td>
                </tr>
                <tr>
                  <th>Units</th>
                  <td>{request.unitsRequired}</td>
                </tr>
                <tr>
                  <th>Urgency</th>
                  <td>{URGENCY_LABELS[request.urgency]}</td>
                </tr>
                <tr>
                  <th>Required by</th>
                  <td>{formatTimestamp(request.requiredBy)}</td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td>{formatTimestamp(request.createdAt)}</td>
                </tr>
                <tr>
                  <th>Source PatientNeed</th>
                  <td>
                    <Link
                      href={`/hospital/patient-needs/${request.patientNeedId}`}
                    >
                      Review record
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 16 }}>
              <button
                type="button"
                disabled={saving || !isPreFulfillment(request.status)}
                onClick={() => void performAction('cancel')}
              >
                Cancel request
              </button>
              <button
                type="button"
                disabled={saving || !canStartFulfillment}
                onClick={() => void performAction('start')}
              >
                Start fulfillment
              </button>
              <button
                type="button"
                disabled={saving || request.status !== 'FULFILLMENT_PENDING'}
                onClick={() => void performAction('confirm')}
              >
                Confirm fulfillment
              </button>
            </div>
          </div>

          <section className="card">
            <h2>Responder coordination</h2>
            {responsesError ? (
              <div className="alert error" role="alert">
                {responsesError}
              </div>
            ) : null}
            <p>
              {responses.length} response reference(s) are associated with this
              request.
            </p>
            {responses.length > 0 ? (
              <ul>
                {responses.map((response) => {
                  const assignment = request.assignments.find(
                    (item) =>
                      item.response.responseId === response.responseId &&
                      item.response.responseType === response.responseType,
                  );
                  const label =
                    response.responseType === 'ORGANIZATION_RESPONSE'
                      ? (response.responderName ?? 'Blood centre')
                      : assignment?.state === 'SELECTED'
                        ? 'Individual donor'
                        : 'Individual donor (anonymous until selected)';
                  const canManageAssignment =
                    isPreFulfillment(request.status) &&
                    (response.status === 'ACCEPTED' ||
                      assignment?.state === 'SELECTED' ||
                      assignment?.state === 'STANDBY');
                  const hasActiveAssignment =
                    assignment?.state === 'SELECTED' ||
                    assignment?.state === 'STANDBY';
                  return (
                    <li key={`${response.responseType}-${response.responseId}`}>
                      <strong>{label}</strong> — {response.status ?? 'Response'}
                      {assignment
                        ? ` — ${assignment.state.replaceAll('_', ' ')}`
                        : ''}
                      {canManageAssignment ? (
                        <span className="row">
                          {hasActiveAssignment ? (
                            <button
                              type="button"
                              disabled={saving || busyResponse !== null}
                              onClick={() =>
                                void performAssignment(response, 'release')
                              }
                            >
                              {busyResponse === response.responseId
                                ? 'Updating…'
                                : 'Release'}
                            </button>
                          ) : response.status === 'ACCEPTED' ? (
                            <>
                              <button
                                type="button"
                                disabled={saving || busyResponse !== null}
                                onClick={() =>
                                  void performAssignment(response, 'select')
                                }
                              >
                                {busyResponse === response.responseId
                                  ? 'Updating…'
                                  : 'Select'}
                              </button>
                              <button
                                type="button"
                                disabled={saving || busyResponse !== null}
                                onClick={() =>
                                  void performAssignment(response, 'standby')
                                }
                              >
                                Place on standby
                              </button>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No responses are available yet.</p>
            )}
          </section>
          {request.assignments.some((item) => item.state === 'SELECTED') ? (
            <CommunicationPanel requestId={id} />
          ) : null}
          {request.status === 'FULFILLMENT_CONFIRMED' ? (
            <div className="alert">
              {selectedAssignment?.response.responseType === 'DONOR_RESPONSE'
                ? 'Fulfillment is confirmed. A DonationRecord was created for the selected Individual donor.'
                : 'Fulfillment is confirmed for the selected Blood Centre. No Individual DonationRecord was created.'}{' '}
              No further lifecycle action is available.
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function isPreFulfillment(status: BloodRequestDetail['status']) {
  return [
    'OPEN',
    'RESPONSES_RECEIVED',
    'COVERED',
    'COORDINATING',
    'BACKUP_REQUIRED',
  ].includes(status);
}
