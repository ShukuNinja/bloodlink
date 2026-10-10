'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  PatientNeedBloodGroup,
  PatientNeedComponent,
  PatientNeedUrgency,
} from '@bloodlink/contracts';
import { validationIssues } from '@/api/client';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  URGENCY_LABELS,
} from '@/features/individual/patient-needs/present';
import { useCreatePatientNeed } from '@/features/individual/patient-needs/hooks';

export default function NewPatientNeedPage() {
  return (
    <Suspense fallback={<main>Loading…</main>}>
      <NewPatientNeedForm />
    </Suspense>
  );
}

function NewPatientNeedForm() {
  const searchParams = useSearchParams();
  const hospitalId = searchParams.get('hospitalId') ?? '';
  const hospitalName = searchParams.get('hospitalName') ?? '';

  const [bloodGroup, setBloodGroup] =
    useState<PatientNeedBloodGroup>('O_POSITIVE');
  const [component, setComponent] =
    useState<PatientNeedComponent>('WHOLE_BLOOD');
  const [units, setUnits] = useState('1');
  const [urgency, setUrgency] = useState<PatientNeedUrgency>('ROUTINE');
  const [requiredBy, setRequiredBy] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { submitting, created, error, create } = useCreatePatientNeed();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!hospitalId) return;

    const requiredByDate = new Date(requiredBy);
    if (!requiredBy || Number.isNaN(requiredByDate.getTime())) {
      setFormError('Required-by must be a valid date and time.');
      return;
    }
    const unitsNumber = Number(units);
    if (!Number.isInteger(unitsNumber) || unitsNumber <= 0) {
      setFormError('Units must be a positive whole number.');
      return;
    }

    await create({
      hospitalId,
      bloodGroup,
      component,
      units: unitsNumber,
      urgency,
      requiredBy: requiredByDate.toISOString(),
      additionalNotes,
    });
  }

  if (created) {
    return (
      <main>
        <h1>Patient need submitted</h1>
        <div className="alert success">
          Your request was submitted and is now pending hospital review.
        </div>
        <div className="card">
          <p>
            <strong>Status:</strong> Pending hospital review
          </p>
          <div className="row">
            <Link href={`/patient-needs/${created.id}`}>View request</Link>
            <Link href="/patient-needs">Go to history</Link>
          </div>
        </div>
      </main>
    );
  }

  const issues = validationIssues(error);

  return (
    <main>
      <h1>Submit a patient need</h1>
      <div className="card">
        {hospitalId ? (
          <p>
            Hospital: <strong>{hospitalName || hospitalId}</strong>{' '}
            <Link href="/hospitals">(change)</Link>
          </p>
        ) : (
          <p>
            No hospital selected.{' '}
            <Link href="/hospitals">Find a nearby hospital</Link> first.
          </p>
        )}

        {formError ? <div className="alert error">{formError}</div> : null}

        {error ? (
          error.isUnauthorized ? (
            <div className="alert error">
              You need to <Link href="/auth">sign in</Link> to submit a patient
              need.
            </div>
          ) : (
            <div className="alert error">
              {error.message}
              {issues.length > 0 ? (
                <ul>
                  {issues.map((issue) => (
                    <li key={`${issue.path}-${issue.code}`}>
                      {issue.path || 'request'}: {issue.code}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field">
              <label htmlFor="bloodGroup">Blood group</label>
              <select
                id="bloodGroup"
                value={bloodGroup}
                onChange={(event) =>
                  setBloodGroup(event.target.value as PatientNeedBloodGroup)
                }
              >
                {Object.entries(BLOOD_GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="component">Component</label>
              <select
                id="component"
                value={component}
                onChange={(event) =>
                  setComponent(event.target.value as PatientNeedComponent)
                }
              >
                {Object.entries(COMPONENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="units">Units</label>
              <input
                id="units"
                type="number"
                min={1}
                step={1}
                value={units}
                onChange={(event) => setUnits(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="urgency">Urgency</label>
              <select
                id="urgency"
                value={urgency}
                onChange={(event) =>
                  setUrgency(event.target.value as PatientNeedUrgency)
                }
              >
                {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="requiredBy">Required by</label>
            <input
              id="requiredBy"
              type="datetime-local"
              value={requiredBy}
              onChange={(event) => setRequiredBy(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="additionalNotes">Coordination notes</label>
            <textarea
              id="additionalNotes"
              rows={3}
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.target.value)}
              placeholder="Context the hospital needs to coordinate this request"
              required
            />
          </div>
          <button
            className="primary"
            type="submit"
            disabled={!hospitalId || submitting}
          >
            {submitting ? 'Submitting…' : 'Submit patient need'}
          </button>
        </form>
      </div>
    </main>
  );
}
