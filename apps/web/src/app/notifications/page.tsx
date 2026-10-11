'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { InAppNotification } from '@bloodlink/contracts';
import { apiRequest, ApiClientError } from '@/api/client';
import type { ApiSuccess } from '@bloodlink/contracts';
import {
  BLOOD_GROUP_LABELS,
  COMPONENT_LABELS,
  URGENCY_LABELS,
  formatTimestamp,
} from '@/features/individual/patient-needs/present';

export default function NotificationsPage() {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<ApiSuccess<InAppNotification[]>>(
        'GET',
        '/notifications',
      );
      setItems(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load current request alerts.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <h1>In-app request alerts</h1>
      <p className="muted">
        Review open blood requests and choose whether you can help. Alerts are
        derived from current records; BloodLink does not keep notification or
        read history.
      </p>
      {loading ? <p aria-live="polite">Loading current alerts…</p> : null}
      {error ? (
        <div className="alert error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <section className="card">
          <p>No current request alerts are available.</p>
          <p className="muted">
            There are no unanswered open requests to show right now.
          </p>
          <Link href="/donor">Review open blood requests</Link>
        </section>
      ) : null}
      {items.length > 0 ? (
        <ul className="list">
          {items.map((item) => (
            <li className="card" key={item.bloodRequestId}>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <dl>
                <dt>Hospital</dt>
                <dd>{item.hospitalName}</dd>
                <dt>Blood group</dt>
                <dd>{BLOOD_GROUP_LABELS[item.bloodGroup]}</dd>
                <dt>Component</dt>
                <dd>{COMPONENT_LABELS[item.component]}</dd>
                <dt>Units</dt>
                <dd>{item.unitsRequired}</dd>
                <dt>Urgency</dt>
                <dd>{URGENCY_LABELS[item.urgency]}</dd>
                <dt>Required by</dt>
                <dd>{formatTimestamp(item.requiredBy)}</dd>
                <dt>Request state</dt>
                <dd>{item.requestStatus.replaceAll('_', ' ')}</dd>
                <dt>Alert source</dt>
                <dd>{alertSource(item.source)}</dd>
              </dl>
              <Link href="/donor">Review request and respond</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function alertSource(source: InAppNotification['source']): string {
  if (source === 'BOTH') return 'Nearby match and hospital subscription';
  if (source === 'NEARBY_MATCH') return 'Nearby match';
  return 'Hospital subscription';
}
