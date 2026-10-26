'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type {
  OrganizationSearchRequest,
  OrganizationSummary,
  OrganizationType,
} from '@bloodlink/contracts';
import { ApiClientError } from '@/api/client';
import { useAuthSession } from '@/app/auth-session';
import { organizationsApi } from '@/features/organizations/api';
import {
  BrowserLocationError,
  parseCoordinates,
  parseRadiusKilometres,
  requestBrowserCoordinates,
} from '@/features/individual/hospitals/location';

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
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [results, setResults] = useState<OrganizationSummary[]>([]);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationActive, setLocationActive] = useState(false);
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [radiusKilometres, setRadiusKilometres] = useState('25');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const organizations = user?.organizations ?? [];
  const displayedOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return results
      .filter((organization) => !type || organization.type === type)
      .filter(
        (organization) =>
          !normalizedQuery ||
          organization.name.toLocaleLowerCase().includes(normalizedQuery),
      )
      .sort((left, right) => {
        const order = left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        });
        return (
          (sortOrder === 'ASC' ? order : -order) ||
          left.id.localeCompare(right.id)
        );
      });
  }, [query, results, sortOrder, type]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void organizationsApi
      .search({ sortOrder: 'ASC' })
      .then((response) => {
        if (active) setResults(response.data);
      })
      .catch((cause) => {
        if (active) {
          setDirectoryError(
            cause instanceof ApiClientError
              ? cause.message
              : 'Could not load the organization directory.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      .catch((cause) => {
        if (active) {
          setSubscriptionError(
            cause instanceof ApiClientError
              ? cause.message
              : 'Could not load your subscription status.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleUseMyLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location lookup.');
      return;
    }

    setLocationLoading(true);
    try {
      const location = await requestBrowserCoordinates(navigator.geolocation);
      setLatitudeInput(String(location.latitude));
      setLongitudeInput(String(location.longitude));
    } catch (cause) {
      setLocationError(
        cause instanceof BrowserLocationError
          ? cause.message
          : 'Could not determine your location. Enter coordinates or retry.',
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function applyLocationFilter() {
    setLocationError(null);
    const parsedCoordinates = parseCoordinates(latitudeInput, longitudeInput);
    if (!parsedCoordinates.ok) {
      setLocationError(parsedCoordinates.message);
      return;
    }
    const parsedRadius = parseRadiusKilometres(radiusKilometres);
    if (!parsedRadius.ok || parsedRadius.value === undefined) {
      setLocationError(
        parsedRadius.ok
          ? 'Enter a radius in kilometres.'
          : parsedRadius.message,
      );
      return;
    }

    const request: OrganizationSearchRequest = {
      ...parsedCoordinates.value,
      radiusMeters: parsedRadius.value,
      sortOrder,
    };
    setLoading(true);
    setDirectoryError(null);
    try {
      const response = await organizationsApi.search(request);
      setResults(response.data);
      setLocationActive(true);
    } catch (cause) {
      setDirectoryError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not filter organizations by location.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function clearLocationFilter() {
    setLocationError(null);
    setLoading(true);
    setDirectoryError(null);
    try {
      const response = await organizationsApi.search({ sortOrder: 'ASC' });
      setResults(response.data);
      setLatitudeInput('');
      setLongitudeInput('');
      setLocationActive(false);
    } catch (cause) {
      setDirectoryError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not reload the full organization directory.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(organization: OrganizationSummary) {
    setBusyId(organization.id);
    setDirectoryError(null);
    setSubscriptionError(null);
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
      setSubscriptionError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update this subscription. Please retry.',
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
    setDirectoryError(null);
    try {
      const response = await organizationsApi.openConversation(
        target.id,
        sourceOrganizationId,
      );
      window.location.assign(
        `/conversations?conversationId=${response.data.id}`,
      );
    } catch (cause) {
      setDirectoryError(
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
            Browse every active hospital and blood bank, search by name, filter
            the list, and follow organizations for request updates.
          </p>
        </div>
        <Link className="btn-link" href="/subscriptions">
          My subscriptions
        </Link>
      </div>

      <section
        className="card organization-search"
        aria-label="Directory filters"
      >
        <label className="field">
          <span>Search hospitals and blood banks</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type an organization name"
            maxLength={255}
          />
        </label>
        <div className="row">
          <label className="field">
            <span>Organization type</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as OrganizationType | '')
              }
            >
              <option value="">All hospitals and blood banks</option>
              <option value="HOSPITAL">Hospitals</option>
              <option value="BLOOD_CENTRE">Blood banks</option>
            </select>
          </label>
          <label className="field">
            <span>Sort organizations</span>
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as 'ASC' | 'DESC')
              }
            >
              <option value="ASC">Name: A to Z</option>
              <option value="DESC">Name: Z to A</option>
            </select>
          </label>
        </div>
        <details className="location-filter">
          <summary>Filter by location and radius</summary>
          <p className="muted">
            Use your current location or enter coordinates. Coordinates are used
            only to filter this list and are not saved.
          </p>
          {locationError ? (
            <div className="alert error" role="alert">
              {locationError}
            </div>
          ) : null}
          <div className="row">
            <button
              type="button"
              disabled={locationLoading}
              onClick={() => void handleUseMyLocation()}
            >
              {locationLoading ? 'Getting location…' : 'Use my location'}
            </button>
            <span className="muted">Location permission is optional.</span>
          </div>
          <div className="row">
            <label className="field">
              <span>Latitude</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="-90"
                max="90"
                value={latitudeInput}
                onChange={(event) => {
                  setLatitudeInput(event.target.value);
                }}
                placeholder="e.g. 13.0827"
              />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="-180"
                max="180"
                value={longitudeInput}
                onChange={(event) => {
                  setLongitudeInput(event.target.value);
                }}
                placeholder="e.g. 80.2707"
              />
            </label>
            <label className="field">
              <span>Radius (kilometres)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0.1"
                step="any"
                value={radiusKilometres}
                onChange={(event) => setRadiusKilometres(event.target.value)}
                placeholder="25"
              />
            </label>
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={loading}
              onClick={() => void applyLocationFilter()}
            >
              {loading ? 'Filtering…' : 'Apply radius filter'}
            </button>
            {locationActive ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void clearLocationFilter()}
              >
                Clear location filter
              </button>
            ) : null}
          </div>
        </details>
      </section>

      {directoryError ? (
        <div className="alert error" role="alert">
          {directoryError}
        </div>
      ) : null}
      {subscriptionError ? (
        <div className="alert error" role="alert">
          {subscriptionError}
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}

      <section
        className="organization-directory"
        aria-label="Hospital and blood bank directory"
      >
        <div className="organization-directory-heading">
          <h2>All hospitals and blood banks</h2>
          <span className="muted">
            {loading
              ? 'Loading directory…'
              : `${displayedOrganizations.length} organizations`}
          </span>
        </div>
        {loading && !results.length ? (
          <div className="card" role="status">
            Loading the organization directory…
          </div>
        ) : null}
        {!loading && displayedOrganizations.length === 0 ? (
          <div className="card">
            <p>
              {locationActive
                ? 'No active organizations were found within this radius.'
                : 'No active organizations matched these filters.'}
            </p>
          </div>
        ) : null}
        {displayedOrganizations.length ? (
          <section
            className="organization-results"
            aria-label="Organization directory results"
          >
            {displayedOrganizations.map((organization) => {
              const sources = organizations.filter(
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
      </section>
    </main>
  );
}
