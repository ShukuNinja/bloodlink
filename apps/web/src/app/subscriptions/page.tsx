'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { OrganizationSubscription } from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { organizationsApi } from '@/features/organizations/api';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<
    OrganizationSubscription[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await organizationsApi.listSubscriptions();
      setSubscriptions(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not load subscriptions.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function unsubscribe(organizationId: string) {
    setBusyId(organizationId);
    setError(null);
    try {
      await organizationsApi.unsubscribe(organizationId);
      setSubscriptions((current) =>
        current.filter((item) => item.organizationId !== organizationId),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not remove this subscription.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main>
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">YOUR NETWORK</p>
          <h1>Subscribed organizations</h1>
          <p className="muted">
            Request updates from hospitals and blood banks you follow.
          </p>
        </div>
        <Link className="btn-link" href="/organizations">
          Find organizations
        </Link>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading subscriptions…</p> : null}
      {!loading && !subscriptions.length ? (
        <section className="card">
          <h2>No subscriptions yet</h2>
          <p>
            Search for a hospital or blood bank to follow its request updates.
          </p>
          <Link href="/organizations">Find hospitals and blood banks</Link>
        </section>
      ) : null}
      <section className="organization-results" aria-label="Subscriptions">
        {subscriptions.map((item) => (
          <article className="card organization-result" key={item.id}>
            <div>
              <span className="badge neutral">
                {item.organizationType === 'HOSPITAL'
                  ? 'Hospital'
                  : 'Blood bank'}
              </span>
              <h2>{item.organizationName}</h2>
              <span className="muted">
                Subscribed {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              disabled={busyId === item.organizationId}
              onClick={() => void unsubscribe(item.organizationId)}
            >
              {busyId === item.organizationId ? 'Removing…' : 'Unsubscribe'}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
