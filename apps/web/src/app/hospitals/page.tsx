'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useHospitalSearch } from '@/features/individual/hospitals/hooks';

export default function HospitalsPage() {
  const router = useRouter();
  const { results, loading, error, searched, search } = useHospitalSearch();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('');
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
      latitude === '' ||
      longitude === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      setFormError('Latitude and longitude are required numbers.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setFormError('Latitude must be between -90 and 90.');
      return;
    }
    if (lon < -180 || lon > 180) {
      setFormError('Longitude must be between -180 and 180.');
      return;
    }
    let radius: number | undefined;
    if (radiusMeters !== '') {
      radius = Number(radiusMeters);
      if (!Number.isFinite(radius) || radius <= 0) {
        setFormError('Search radius must be a positive number of meters.');
        return;
      }
    }

    await search({
      latitude: lat,
      longitude: lon,
      radiusMeters: radius,
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
        Search uses your current coordinates to list hospitals accepting patient
        needs. Coordinates are never stored.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        {formError ? <div className="alert error">{formError}</div> : null}
        <div className="row">
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              inputMode="decimal"
              placeholder="6.5244"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              inputMode="decimal"
              placeholder="3.3792"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="radius">Radius (meters, optional)</label>
            <input
              id="radius"
              inputMode="numeric"
              placeholder="25000"
              value={radiusMeters}
              onChange={(event) => setRadiusMeters(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="query">Name contains (optional)</label>
            <input
              id="query"
              placeholder="City"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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

      {searched && !loading && !error && results && results.length === 0 ? (
        <div className="card">
          <p>No hospitals found in this area. Try a wider radius.</p>
        </div>
      ) : null}

      {results && results.length > 0 ? (
        <div className="card">
          <h2>Hospitals near you</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Coordinates</th>
                <th aria-label="Actions" />
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
                  <td>
                    <button
                      className="primary"
                      onClick={() => selectHospital(hospital.id, hospital.name)}
                    >
                      Select
                    </button>
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
