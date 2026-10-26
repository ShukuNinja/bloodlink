'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type {
  OrganizationSummary,
  OrganizationType,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { useAuthSession } from '@/app/auth-session';
import { organizationsApi } from '@/features/organizations/api';

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get('type');
  const initialType: OrganizationType | '' =
    requestedType === 'HOSPITAL' || requestedType === 'BLOOD_CENTRE'
      ? requestedType
      : '';
  const { user } = useAuthSession();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OrganizationType | ''>(initialType);
  const [results, setResults] = useState<OrganizationSummary[] | null>(null);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const organizations = user?.organizations ?? [];
  const sourceOptions = useMemo(() => organizations, [organizations]);

  useEffect(() => {
    let active = true;
    void organizationsApi
      .listSubscriptions()
      .then((response) => {
        if (active) {
          setSubscribedIds(
            new Set(
              response.data
                .filter((item) => item.status === 'ACTIVE')
                .map((item) => item.organizationId),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setError('Could not load your subscriptions.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setError('Enter an organization name to search.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await organizationsApi.search({
        query: query.trim(),
        ...(type ? { type } : {}),
      });
      setResults(response.data);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not search organizations.',
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(organization: OrganizationSummary) {
    setBusyId(organization.id);
    setError(null);
    setNotice(null);
    try {
      if (subscribedIds.has(organization.id)) {
        await organizationsApi.unsubscribe(organization.id);
        setSubscribedIds((current) => {
          const next = new Set(current);
          next.delete(organization.id);
          return next;
        });
        setNotice(`Unsubscribed from ${organization.name}.`);
      } else {
        await organizationsApi.subscribe(organization.id);
        setSubscribedIds((current) => new Set(current).add(organization.id));
        setNotice(`Subscribed to ${organization.name}.`);
      }
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update this subscription.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function startConversation(
    target: OrganizationSummary,
    sourceOrganizationId: string,
  ) {
    setBusyId(target.id);
    setError(null);
    try {
      const response = await organizationsApi.openConversation(
        target.id,
        sourceOrganizationId,
      );
      window.location.assign(
        `/conversations?conversationId=${response.data.id}`,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not open this conversation.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="organization-page">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">ORGANIZATION DIRECTORY</p>
          <h1>Find hospitals and blood banks</h1>
          <p className="muted">
            Search active organizations by name, follow them for request
            updates, or start a hospital–blood bank conversation.
          </p>
        </div>
        <Link className="btn-link" href="/subscriptions">
          My subscriptions
        </Link>
      </div>

      <form
        className="card organization-search"
        onSubmit={(event) => void search(event)}
      >
        <label className="field">
          <span>Organization name</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            maxLength={255}
            required
          />
        </label>
        <label className="field">
          <span>Organization type</span>
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as OrganizationType | '')
            }
          >
            <option value="">Hospitals and blood banks</option>
            <option value="HOSPITAL">Hospitals</option>
            <option value="BLOOD_CENTRE">Blood banks</option>
          </select>
        </label>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}
      {results && !results.length ? (
        <div className="card">
          <p>No active organizations matched that search.</p>
        </div>
      ) : null}
      {results?.length ? (
        <section
          className="organization-results"
          aria-label="Organization search results"
        >
          {results.map((organization) => {
            const sources = sourceOptions.filter(
              (item) => item.type !== organization.type,
            );
            const canChat = sources.length > 0;
            return (
              <article
                className="card organization-result"
                key={organization.id}
              >
                <div>
                  <span className="badge neutral">
                    {organization.type === 'HOSPITAL'
                      ? 'Hospital'
                      : 'Blood bank'}
                  </span>
                  <h2>{organization.name}</h2>
                </div>
                <div className="organization-actions">
                  <button
                    type="button"
                    disabled={busyId === organization.id}
                    onClick={() => void toggleSubscription(organization)}
                  >
                    {busyId === organization.id
                      ? 'Saving…'
                      : subscribedIds.has(organization.id)
                        ? 'Unsubscribe'
                        : 'Subscribe'}
                  </button>
                  {canChat ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={busyId === organization.id}
                      onClick={() =>
                        void startConversation(organization, sources[0].id)
                      }
                    >
                      Message
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
