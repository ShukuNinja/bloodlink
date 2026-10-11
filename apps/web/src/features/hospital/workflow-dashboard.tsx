'use client';

import type {
  AssignResponderRequest,
  BloodRequestStatus,
  HospitalPatientNeedQuery,
  PatientNeedStatus,
  ResponderAssignmentView,
  ResponderResponseReference,
} from '@bloodlink/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { ApiClientError } from '@/api/client';
import {
  COMPONENT_LABELS,
  BLOOD_GROUP_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
  statusBadgeClass,
} from '@/features/individual/patient-needs/present';
import {
  useHospitalPatientNeed,
  useHospitalPatientNeeds,
  useRejectHospitalPatientNeed,
  useVerifyHospitalPatientNeed,
} from './patient-needs/hooks';
import {
  useCancelHospitalBloodRequest,
  useFulfillmentHospitalBloodRequest,
  useHospitalBloodRequest,
  useHospitalBloodRequests,
} from './blood-requests/hooks';
import {
  useHospitalResponderResponses,
  useRespondToHospitalRequest,
} from './responder-coordination/hooks';

const PAGE_SIZE = 10;
const PRE_FULFILLMENT_STATUSES: BloodRequestStatus[] = [
  'OPEN',
  'RESPONSES_RECEIVED',
  'COVERED',
  'COORDINATING',
  'BACKUP_REQUIRED',
];

const REQUEST_STATUS_LABELS: Record<BloodRequestStatus, string> = {
  OPEN: 'Open',
  RESPONSES_RECEIVED: 'Responses received',
  COVERED: 'Covered',
  COORDINATING: 'Coordinating',
  BACKUP_REQUIRED: 'Backup required',
  FULFILLMENT_PENDING: 'Fulfillment pending',
  FULFILLMENT_CONFIRMED: 'Fulfillment confirmed',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
};

const NEED_STATUS_OPTIONS: Array<{
  value: PatientNeedStatus | '';
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_HOSPITAL_REVIEW', label: 'Pending review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const REQUEST_STATUS_OPTIONS: Array<{
  value: BloodRequestStatus | '';
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({
    value: value as BloodRequestStatus,
    label,
  })),
];

function ErrorNotice({
  error,
  retry,
}: {
  error: ApiClientError | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      {error.isUnauthorized ? (
        <>
          Your session is not authorized. <Link href="/auth">Sign in</Link> with
          an active hospital staff account.
        </>
      ) : (
        error.message
      )}
      {retry ? (
        <button
          className="workflow-inline-button"
          onClick={retry}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="workflow-pagination">
      <button
        disabled={page <= 1 || loading}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      <span className="muted">
        Page {page} of {Math.max(totalPages, 1)} · {total} total
      </span>
      <button
        disabled={page >= totalPages || loading}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function NeedSummary({
  id,
  hospitalId,
  bloodGroup,
  component,
  units,
  urgency,
  status,
  createdAt,
}: {
  id: string;
  hospitalId: string;
  bloodGroup: keyof typeof BLOOD_GROUP_LABELS;
  component: keyof typeof COMPONENT_LABELS;
  units: number;
  urgency: keyof typeof URGENCY_LABELS;
  status: PatientNeedStatus;
  createdAt: string;
}) {
  return (
    <>
      <span className="workflow-summary-main">
        <strong>{BLOOD_GROUP_LABELS[bloodGroup]}</strong>
        <span>{COMPONENT_LABELS[component]}</span>
        <span>{units} units</span>
      </span>
      <span className="workflow-summary-meta">
        <span>{URGENCY_LABELS[urgency]}</span>
        <span className={statusBadgeClass(status)}>
          {STATUS_LABELS[status]}
        </span>
        <span className="muted">{formatTimestamp(createdAt)}</span>
        <span className="workflow-id">
          Need {id.slice(0, 8)} · Hospital {hospitalId.slice(0, 8)}
        </span>
      </span>
    </>
  );
}

export default function HospitalWorkflowDashboard() {
  const [section, setSection] = useState<'needs' | 'requests'>('needs');
  const [needStatus, setNeedStatus] = useState<PatientNeedStatus | ''>(
    'PENDING_HOSPITAL_REVIEW',
  );
  const [requestStatus, setRequestStatus] = useState<BloodRequestStatus | ''>(
    '',
  );
  const [needPage, setNeedPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [selectedNeedId, setSelectedNeedId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const needQuery: HospitalPatientNeedQuery = {
    page: needPage,
    pageSize: PAGE_SIZE,
    status: needStatus || undefined,
  };
  const needs = useHospitalPatientNeeds(needQuery);
  const needDetail = useHospitalPatientNeed(selectedNeedId ?? undefined);
  const requests = useHospitalBloodRequests({
    page: requestPage,
    pageSize: PAGE_SIZE,
    status: requestStatus || undefined,
  });
  const requestDetail = useHospitalBloodRequest(selectedRequestId ?? undefined);
  const responses = useHospitalResponderResponses(
    selectedRequestId ?? undefined,
  );
  const verifyNeed = useVerifyHospitalPatientNeed();
  const rejectNeed = useRejectHospitalPatientNeed();
  const cancelRequest = useCancelHospitalBloodRequest();
  const fulfillment = useFulfillmentHospitalBloodRequest();
  const responderAction = useRespondToHospitalRequest();

  async function handleVerify(patientNeedId: string) {
    if (
      !window.confirm(
        'Verify this patient need and create its official blood request?',
      )
    ) {
      return;
    }
    setNotice(null);
    const result = await verifyNeed.verify(patientNeedId);
    if (!result) return;
    setNotice(
      'Patient need verified and an official blood request was created.',
    );
    setSelectedNeedId(null);
    setSelectedRequestId(result.bloodRequest.id);
    setSection('requests');
    await Promise.all([needs.reload(), requests.reload()]);
  }

  async function handleReject(patientNeedId: string) {
    if (
      !window.confirm(
        'Reject this patient need? This decision cannot be undone here.',
      )
    ) {
      return;
    }
    setNotice(null);
    const result = await rejectNeed.reject(patientNeedId);
    if (!result) return;
    setNotice('Patient need rejected.');
    await Promise.all([needs.reload(), needDetail.reload()]);
  }

  async function refreshRequest() {
    await Promise.all([
      requests.reload(),
      requestDetail.reload(),
      responses.reload(),
    ]);
  }

  async function handleCancel(requestId: string) {
    if (!window.confirm('Cancel this blood request?')) return;
    setNotice(null);
    const result = await cancelRequest.cancel(requestId);
    if (!result) return;
    setNotice('Blood request cancelled.');
    await refreshRequest();
  }

  async function handleFulfillmentAction(
    action: 'start' | 'confirm',
    requestId: string,
  ) {
    const prompt =
      action === 'start'
        ? 'Record that fulfillment has started?'
        : 'Confirm that fulfillment is complete?';
    if (!window.confirm(prompt)) return;
    setNotice(null);
    const result =
      action === 'start'
        ? await fulfillment.startFulfillment(requestId)
        : await fulfillment.confirmFulfillment(requestId);
    if (!result) return;
    setNotice(
      action === 'start' ? 'Fulfillment started.' : 'Fulfillment confirmed.',
    );
    await refreshRequest();
  }

  async function handleResponderAction(
    response: ResponderResponseReference,
    action: 'select' | 'standby' | 'release',
  ) {
    if (!selectedRequestId) return;
    setNotice(null);
    const input: AssignResponderRequest = {
      responseType: response.responseType,
    };
    const result = await responderAction.perform(
      selectedRequestId,
      response.responseId,
      action,
      input,
    );
    if (!result) return;
    setNotice(
      action === 'select'
        ? 'Responder selected.'
        : action === 'standby'
          ? 'Responder placed on standby.'
          : 'Responder released.',
    );
    await refreshRequest();
  }

  const selectedAssignment = (
    response: ResponderResponseReference,
    assignments: ResponderAssignmentView[],
  ) =>
    assignments.find(
      (assignment) =>
        assignment.response.responseId === response.responseId &&
        assignment.response.responseType === response.responseType,
    );

  return (
    <main className="workflow-page">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">HOSPITAL OPERATIONS</p>
          <h1>Review &amp; coordination</h1>
          <p className="muted">
            Review patient needs, create official requests, and track
            hospital-side coordination.
          </p>
        </div>
        <button
          className="workflow-refresh"
          onClick={() => {
            void Promise.all([needs.reload(), requests.reload()]);
            if (selectedNeedId) void needDetail.reload();
            if (selectedRequestId) void refreshRequest();
          }}
          type="button"
        >
          Refresh data
        </button>
      </div>

      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}
      <ErrorNotice error={verifyNeed.error} />
      <ErrorNotice error={rejectNeed.error} />
      <ErrorNotice error={cancelRequest.error} />
      <ErrorNotice error={fulfillment.error} />
      <ErrorNotice error={responderAction.error} />

      <div
        className="workflow-tabs"
        role="tablist"
        aria-label="Hospital workflow sections"
      >
        <button
          aria-selected={section === 'needs'}
          className={
            section === 'needs' ? 'workflow-tab active' : 'workflow-tab'
          }
          onClick={() => setSection('needs')}
          role="tab"
          type="button"
        >
          Patient needs
          {needs.data ? (
            <span className="workflow-count">{needs.data.meta.total}</span>
          ) : null}
        </button>
        <button
          aria-selected={section === 'requests'}
          className={
            section === 'requests' ? 'workflow-tab active' : 'workflow-tab'
          }
          onClick={() => setSection('requests')}
          role="tab"
          type="button"
        >
          Blood requests
          {requests.data ? (
            <span className="workflow-count">{requests.data.meta.total}</span>
          ) : null}
        </button>
      </div>

      {section === 'needs' ? (
        <section
          aria-label="Patient needs for review"
          className="workflow-layout"
        >
          <div className="workflow-panel">
            <div className="workflow-panel-heading">
              <div>
                <h2>Patient needs</h2>
                <p className="muted">Needs submitted to your hospital.</p>
              </div>
              <label className="workflow-filter">
                <span className="sr-only">Filter patient needs by status</span>
                <select
                  value={needStatus}
                  onChange={(event) => {
                    setNeedStatus(event.target.value as PatientNeedStatus | '');
                    setNeedPage(1);
                  }}
                >
                  {NEED_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ErrorNotice
              error={needs.error}
              retry={() => void needs.reload()}
            />
            {needs.loading ? (
              <p className="muted">Loading patient needs…</p>
            ) : null}
            {!needs.loading && needs.data?.data.length === 0 ? (
              <div className="workflow-empty">
                <strong>No patient needs found</strong>
                <span>Try another status filter or refresh later.</span>
              </div>
            ) : null}
            {needs.data && needs.data.data.length > 0 ? (
              <>
                <div className="workflow-list">
                  {needs.data.data.map((need) => (
                    <button
                      aria-pressed={selectedNeedId === need.id}
                      className={
                        selectedNeedId === need.id
                          ? 'workflow-list-item selected'
                          : 'workflow-list-item'
                      }
                      key={need.id}
                      onClick={() => setSelectedNeedId(need.id)}
                      type="button"
                    >
                      <NeedSummary {...need} />
                    </button>
                  ))}
                </div>
                <Pagination
                  page={needs.data.meta.page}
                  totalPages={needs.data.meta.totalPages}
                  total={needs.data.meta.total}
                  loading={needs.loading}
                  onPageChange={setNeedPage}
                />
              </>
            ) : null}
          </div>

          <div className="workflow-panel workflow-detail">
            {!selectedNeedId ? (
              <div className="workflow-empty workflow-empty-detail">
                <span className="workflow-detail-icon" aria-hidden="true">
                  +
                </span>
                <strong>Select a patient need</strong>
                <span>Review its details and choose an available action.</span>
              </div>
            ) : needDetail.loading ? (
              <p className="muted">Loading patient need…</p>
            ) : needDetail.error ? (
              <ErrorNotice
                error={needDetail.error}
                retry={() => void needDetail.reload()}
              />
            ) : needDetail.record ? (
              <>
                <div className="workflow-detail-title">
                  <div>
                    <p className="workflow-eyebrow">PATIENT NEED</p>
                    <h2>
                      {BLOOD_GROUP_LABELS[needDetail.record.bloodGroup]} ·{' '}
                      {COMPONENT_LABELS[needDetail.record.component]}
                    </h2>
                  </div>
                  <span className={statusBadgeClass(needDetail.record.status)}>
                    {STATUS_LABELS[needDetail.record.status]}
                  </span>
                </div>
                <dl className="workflow-facts">
                  <div>
                    <dt>Units</dt>
                    <dd>{needDetail.record.units}</dd>
                  </div>
                  <div>
                    <dt>Urgency</dt>
                    <dd>{URGENCY_LABELS[needDetail.record.urgency]}</dd>
                  </div>
                  <div>
                    <dt>Required by</dt>
                    <dd>{formatTimestamp(needDetail.record.requiredBy)}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatTimestamp(needDetail.record.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Hospital ID</dt>
                    <dd>{needDetail.record.hospitalId}</dd>
                  </div>
                </dl>
                <div className="workflow-notes">
                  <h3>Additional notes</h3>
                  <p>
                    {needDetail.record.additionalNotes ||
                      'No additional notes provided.'}
                  </p>
                </div>
                {needDetail.record.status === 'PENDING_HOSPITAL_REVIEW' ? (
                  <div className="workflow-actions">
                    <button
                      className="primary"
                      disabled={verifyNeed.verifying || rejectNeed.rejecting}
                      onClick={() => void handleVerify(needDetail.record!.id)}
                      type="button"
                    >
                      {verifyNeed.verifying
                        ? 'Verifying…'
                        : 'Verify & create request'}
                    </button>
                    <button
                      className="danger"
                      disabled={verifyNeed.verifying || rejectNeed.rejecting}
                      onClick={() => void handleReject(needDetail.record!.id)}
                      type="button"
                    >
                      {rejectNeed.rejecting ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                ) : (
                  <p className="muted workflow-readonly-note">
                    This need is no longer awaiting a review decision.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          aria-label="Blood request management"
          className="workflow-layout"
        >
          <div className="workflow-panel">
            <div className="workflow-panel-heading">
              <div>
                <h2>Blood requests</h2>
                <p className="muted">
                  Official requests created by hospital review.
                </p>
              </div>
              <label className="workflow-filter">
                <span className="sr-only">Filter blood requests by status</span>
                <select
                  value={requestStatus}
                  onChange={(event) => {
                    setRequestStatus(
                      event.target.value as BloodRequestStatus | '',
                    );
                    setRequestPage(1);
                  }}
                >
                  {REQUEST_STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ErrorNotice
              error={requests.error}
              retry={() => void requests.reload()}
            />
            {requests.loading ? (
              <p className="muted">Loading blood requests…</p>
            ) : null}
            {!requests.loading && requests.data?.data.length === 0 ? (
              <div className="workflow-empty">
                <strong>No blood requests found</strong>
                <span>Verified patient needs create official requests.</span>
              </div>
            ) : null}
            {requests.data && requests.data.data.length > 0 ? (
              <>
                <div className="workflow-list">
                  {requests.data.data.map((request) => (
                    <button
                      aria-pressed={selectedRequestId === request.id}
                      className={
                        selectedRequestId === request.id
                          ? 'workflow-list-item selected'
                          : 'workflow-list-item'
                      }
                      key={request.id}
                      onClick={() => setSelectedRequestId(request.id)}
                      type="button"
                    >
                      <span className="workflow-summary-main">
                        <strong>
                          {BLOOD_GROUP_LABELS[request.bloodGroup]}
                        </strong>
                        <span>{COMPONENT_LABELS[request.component]}</span>
                        <span>{request.unitsRequired} units</span>
                      </span>
                      <span className="workflow-summary-meta">
                        <span className="workflow-request-status">
                          {REQUEST_STATUS_LABELS[request.status]}
                        </span>
                        <span>{URGENCY_LABELS[request.urgency]}</span>
                        <span className="muted">
                          {formatTimestamp(request.createdAt)}
                        </span>
                        <span className="workflow-id">
                          Request {request.id.slice(0, 8)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <Pagination
                  page={requests.data.meta.page}
                  totalPages={requests.data.meta.totalPages}
                  total={requests.data.meta.total}
                  loading={requests.loading}
                  onPageChange={setRequestPage}
                />
              </>
            ) : null}
          </div>

          <div className="workflow-panel workflow-detail">
            {!selectedRequestId ? (
              <div className="workflow-empty workflow-empty-detail">
                <span className="workflow-detail-icon" aria-hidden="true">
                  ↗
                </span>
                <strong>Select a blood request</strong>
                <span>View its current state, responders, and actions.</span>
              </div>
            ) : requestDetail.loading ? (
              <p className="muted">Loading blood request…</p>
            ) : requestDetail.error ? (
              <ErrorNotice
                error={requestDetail.error}
                retry={() => void requestDetail.reload()}
              />
            ) : requestDetail.record ? (
              <>
                <div className="workflow-detail-title">
                  <div>
                    <p className="workflow-eyebrow">OFFICIAL REQUEST</p>
                    <h2>
                      {BLOOD_GROUP_LABELS[requestDetail.record.bloodGroup]} ·{' '}
                      {COMPONENT_LABELS[requestDetail.record.component]}
                    </h2>
                  </div>
                  <span className="workflow-request-status">
                    {REQUEST_STATUS_LABELS[requestDetail.record.status]}
                  </span>
                </div>
                <dl className="workflow-facts">
                  <div>
                    <dt>Units required</dt>
                    <dd>{requestDetail.record.unitsRequired}</dd>
                  </div>
                  <div>
                    <dt>Urgency</dt>
                    <dd>{URGENCY_LABELS[requestDetail.record.urgency]}</dd>
                  </div>
                  <div>
                    <dt>Required by</dt>
                    <dd>{formatTimestamp(requestDetail.record.requiredBy)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatTimestamp(requestDetail.record.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Patient need</dt>
                    <dd>{requestDetail.record.patientNeedId}</dd>
                  </div>
                </dl>

                <div className="workflow-actions workflow-actions-wrap">
                  {PRE_FULFILLMENT_STATUSES.includes(
                    requestDetail.record.status,
                  ) ? (
                    <button
                      className="danger"
                      disabled={cancelRequest.cancelling}
                      onClick={() =>
                        void handleCancel(requestDetail.record!.id)
                      }
                      type="button"
                    >
                      {cancelRequest.cancelling
                        ? 'Cancelling…'
                        : 'Cancel request'}
                    </button>
                  ) : null}
                  {PRE_FULFILLMENT_STATUSES.includes(
                    requestDetail.record.status,
                  ) ? (
                    <button
                      className="primary"
                      disabled={
                        fulfillment.submitting ||
                        !requestDetail.record.assignments.some(
                          (assignment) => assignment.state === 'SELECTED',
                        )
                      }
                      onClick={() =>
                        void handleFulfillmentAction(
                          'start',
                          requestDetail.record!.id,
                        )
                      }
                      title={
                        requestDetail.record.assignments.some(
                          (assignment) => assignment.state === 'SELECTED',
                        )
                          ? undefined
                          : 'Select a responder before starting fulfillment.'
                      }
                      type="button"
                    >
                      {fulfillment.submitting
                        ? 'Updating…'
                        : 'Start fulfillment'}
                    </button>
                  ) : null}
                  {requestDetail.record.status === 'FULFILLMENT_PENDING' ? (
                    <button
                      className="primary"
                      disabled={fulfillment.submitting}
                      onClick={() =>
                        void handleFulfillmentAction(
                          'confirm',
                          requestDetail.record!.id,
                        )
                      }
                      type="button"
                    >
                      {fulfillment.submitting
                        ? 'Updating…'
                        : 'Confirm fulfillment'}
                    </button>
                  ) : null}
                </div>

                <div className="workflow-subsection">
                  <div className="workflow-panel-heading">
                    <div>
                      <h3>Responder coordination</h3>
                      <p className="muted">
                        Assignments are managed separately from response status.
                      </p>
                    </div>
                    <button
                      className="workflow-inline-button"
                      disabled={responses.loading}
                      onClick={() => void responses.reload()}
                      type="button"
                    >
                      Refresh responses
                    </button>
                  </div>
                  <ErrorNotice
                    error={responses.error}
                    retry={() => void responses.reload()}
                  />
                  {responses.loading ? (
                    <p className="muted">Loading responses…</p>
                  ) : null}
                  {!responses.loading &&
                  responses.responses?.data.length === 0 ? (
                    <p className="muted">
                      No responder responses are available for this request yet.
                    </p>
                  ) : null}
                  {responses.responses?.data.map((response) => {
                    const assignment = selectedAssignment(
                      response,
                      requestDetail.record!.assignments,
                    );
                    return (
                      <div
                        className="workflow-responder"
                        key={`${response.responseType}:${response.responseId}`}
                      >
                        <div>
                          <strong>
                            {response.responseType === 'DONOR_RESPONSE'
                              ? 'Donor response'
                              : 'Blood-centre response'}
                          </strong>
                          <span className="workflow-id">
                            {response.responseId}
                          </span>
                          {assignment ? (
                            <span className="workflow-assignment-state">
                              Assignment: {assignment.state.toLowerCase()}
                            </span>
                          ) : (
                            <span className="muted">Not assigned</span>
                          )}
                        </div>
                        <div className="workflow-responder-actions">
                          {PRE_FULFILLMENT_STATUSES.includes(
                            requestDetail.record!.status,
                          ) ? (
                            <>
                              <button
                                className="primary"
                                disabled={responderAction.submitting}
                                onClick={() =>
                                  void handleResponderAction(response, 'select')
                                }
                                type="button"
                              >
                                Select
                              </button>
                              <button
                                disabled={responderAction.submitting}
                                onClick={() =>
                                  void handleResponderAction(
                                    response,
                                    'standby',
                                  )
                                }
                                type="button"
                              >
                                Standby
                              </button>
                              {assignment && assignment.state !== 'RELEASED' ? (
                                <button
                                  className="danger"
                                  disabled={responderAction.submitting}
                                  onClick={() =>
                                    void handleResponderAction(
                                      response,
                                      'release',
                                    )
                                  }
                                  type="button"
                                >
                                  Release
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {requestDetail.record.assignments.length > 0 ? (
                    <p className="workflow-assignment-total muted">
                      {requestDetail.record.assignments.length} assignment(s)
                      currently recorded.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
