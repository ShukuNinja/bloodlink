'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEffect } from 'react';
import { useHospitalSearch } from '@/features/individual/hospitals/hooks';
import { ApiClientError } from '@/api/client';
import { formatDistanceMeters } from '@bloodlink/ui';
import { hospitalSubscriptionApi } from '@/features/individual/hospitals/api';
import { isSubscriptionActionDisabled } from '@/features/individual/hospitals/subscription-state';
import {
  BrowserLocationError,
  parseCoordinates,
  parseRadiusKilometres,
  requestBrowserCoordinates,
} from '@/features/individual/hospitals/location';

export default function HospitalsPage() {
  const router = useRouter();
  const { results, loading, error, searched, search } = useHospitalSearch();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKilometres, setRadiusKilometres] = useState('');
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionBusyIds, setSubscriptionBusyIds] = useState<Set<string>>(
    new Set(),
  );
  const [subscriptionLoadError, setSubscriptionLoadError] = useState<
    string | null
  >(null);
  const [subscriptionActionError, setSubscriptionActionError] = useState<
    string | null
  >(null);
  const [subscriptionNotice, setSubscriptionNotice] = useState<string | null>(
    null,
  );
  const [subscriptionReloadKey, setSubscriptionReloadKey] = useState(0);
  const resultIds = results?.map((hospital) => hospital.id).join(',') ?? '';

  useEffect(() => {
    if (!searched || !resultIds) return;
    let active = true;
    setSubscriptionLoading(true);
    setSubscriptionLoadError(null);
    hospitalSubscriptionApi
      .list()
      .then((response) => {
        if (!active) return;
        setSubscribedIds(
          new Set(
            response.data
              .filter((row) => row.status === 'ACTIVE')
              .map((row) => row.organizationId),
          ),
        );
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSubscriptionLoadError(
          cause instanceof ApiClientError
            ? cause.message
            : 'Could not load subscription state.',
        );
      })
      .finally(() => {
        if (active) setSubscriptionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [resultIds, searched, subscriptionReloadKey]);

  async function toggleSubscription(hospitalId: string, hospitalName: string) {
    setSubscriptionBusyIds((current) => new Set(current).add(hospitalId));
    setSubscriptionActionError(null);
    setSubscriptionNotice(null);
    try {
      if (subscribedIds.has(hospitalId)) {
        await hospitalSubscriptionApi.unsubscribe(hospitalId);
        setSubscribedIds((current) => {
          const next = new Set(current);
          next.delete(hospitalId);
          return next;
        });
        setSubscriptionNotice(`Unsubscribed from ${hospitalName}.`);
      } else {
        const response = await hospitalSubscriptionApi.subscribe(hospitalId);
        if (response.data.status === 'ACTIVE') {
          setSubscribedIds((current) => new Set(current).add(hospitalId));
          setSubscriptionNotice(`Subscribed to ${hospitalName}.`);
        }
      }
    } catch (cause) {
      setSubscriptionActionError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update this subscription.',
      );
      // The server may have committed even if the response was lost. Reload
      // its state before allowing another action for any hospital.
      setSubscriptionLoading(true);
      setSubscriptionReloadKey((current) => current + 1);
    } finally {
      setSubscriptionBusyIds((current) => {
        const next = new Set(current);
        next.delete(hospitalId);
        return next;
      });
    }
  }

  async function handleUseMyLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(
        'This browser does not support location. Enter coordinates manually.',
      );
      return;
    }

    setLocating(true);
    try {
      const coordinates = await requestBrowserCoordinates(
        navigator.geolocation,
      );
      setLatitude(String(coordinates.latitude));
      setLongitude(String(coordinates.longitude));
    } catch (error) {
      setLocationError(
        error instanceof BrowserLocationError
          ? error.message
          : 'Could not determine your location. Enter coordinates manually or retry.',
      );
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const coordinates = parseCoordinates(latitude, longitude);
    if (!coordinates.ok) {
      setFormError(coordinates.message);
      return;
    }
    const radius = parseRadiusKilometres(radiusKilometres);
    if (!radius.ok) {
      setFormError(radius.message);
      return;
    }

    await search({
      ...coordinates.value,
      radiusMeters: radius.value,
      query: query.trim() || undefined,
    });
  }

  function selectHospital(hospitalId: string, hospitalName: string) {
    const params = new URLSearchParams({ hospitalId, hospitalName });
    router.push(`/patient-needs/new?${params.toString()}`);
  }

  return (
    <main>
      <h1>Find nearby hospitals</h1>
      <p className="muted">
        Use your location or enter coordinates to find hospitals accepting
        patient needs. Location is requested only when you choose the button;
        search coordinates are sent to the API and are not persisted.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        {formError ? (
          <div className="alert error" role="alert">
            {formError}
          </div>
        ) : null}
        {locationError ? (
          <div className="alert error" role="alert">
            {locationError}
          </div>
        ) : null}
        <div className="row">
          <button
            type="button"
            onClick={() => void handleUseMyLocation()}
            disabled={locating}
          >
            {locating ? 'Getting location…' : 'Use my location'}
          </button>
          <span className="muted">
            You can deny permission and enter coordinates below.
          </span>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              type="number"
              inputMode="decimal"
              step="any"
              min="-90"
              max="90"
              placeholder="Enter latitude"
              value={latitude}
              onChange={(event) => {
                setLatitude(event.target.value);
                setLocationError(null);
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              type="number"
              inputMode="decimal"
              step="any"
              min="-180"
              max="180"
              placeholder="Enter longitude"
              value={longitude}
              onChange={(event) => {
                setLongitude(event.target.value);
                setLocationError(null);
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="radius">Search radius (kilometres, optional)</label>
            <input
              id="radius"
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              placeholder="25 (API default)"
              value={radiusKilometres}
              onChange={(event) => setRadiusKilometres(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="query">Hospital name contains (optional)</label>
            <input
              id="query"
              placeholder="Hospital name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="muted">
              A location is still required for name filtering.
            </span>
          </div>
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search hospitals'}
        </button>
      </form>

      {error ? (
        error.isUnauthorized ? (
          <div className="alert error">
            You need to <Link href="/auth">sign in</Link> to search hospitals.
          </div>
        ) : (
          <div className="alert error">{error.message}</div>
        )
      ) : null}
      {subscriptionLoadError ? (
        <div className="alert error" role="alert">
          <span>{subscriptionLoadError}</span>{' '}
          <button
            type="button"
            disabled={subscriptionLoading}
            onClick={() => setSubscriptionReloadKey((current) => current + 1)}
          >
            {subscriptionLoading ? 'Retrying…' : 'Retry subscription status'}
          </button>
        </div>
      ) : null}
      {subscriptionActionError ? (
        <div className="alert error" role="alert">
          {subscriptionActionError}
        </div>
      ) : null}
      {subscriptionNotice ? (
        <div className="alert success" role="status">
          {subscriptionNotice}
        </div>
      ) : null}

      {searched && !loading && !error && results && results.length === 0 ? (
        <div className="card">
          <p>No hospitals found in this area. Try a wider radius.</p>
        </div>
      ) : null}

      {!loading && results && results.length > 0 ? (
        <div className="card">
          <h2>Hospitals near you</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Coordinates</th>
                <th>Distance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((hospital) => (
                <tr key={hospital.id}>
                  <td>{hospital.name}</td>
                  <td className="muted">
                    {hospital.latitude.toFixed(4)},{' '}
                    {hospital.longitude.toFixed(4)}
                  </td>
                  <td>{formatDistanceMeters(hospital.distanceMeters)}</td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          selectHospital(hospital.id, hospital.name)
                        }
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        disabled={isSubscriptionActionDisabled(hospital.id, {
                          setupRequired: false,
                          loading: subscriptionLoading,
                          loadError: subscriptionLoadError,
                          busyHospitalIds: subscriptionBusyIds,
                        })}
                        onClick={() =>
                          void toggleSubscription(hospital.id, hospital.name)
                        }
                      >
                        {subscriptionBusyIds.has(hospital.id)
                          ? 'Saving…'
                          : subscribedIds.has(hospital.id)
                            ? 'Unsubscribe'
                            : 'Subscribe'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
