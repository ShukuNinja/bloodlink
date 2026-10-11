'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/api/client';
import * as authApi from '@/api/auth';
import { useAuthSession } from '../auth-session';
import { safePostAuthPath } from '../auth-routing';
import {
  parseCoordinates,
  requestBrowserCoordinates,
} from '@/features/individual/hospitals/location';

export default function AuthPage() {
  const router = useRouter();
  const session = useAuthSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [accountType, setAccountType] = useState<
    'INDIVIDUAL' | 'HOSPITAL' | 'BLOOD_CENTRE' | 'ADMIN'
  >('INDIVIDUAL');
  const [organizationName, setOrganizationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setLocationError(null);
    try {
      const isOrganization =
        mode === 'register' &&
        (accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE');
      const coordinates = isOrganization
        ? parseCoordinates(latitude, longitude)
        : null;
      if (coordinates && !coordinates.ok) {
        setLocationError(coordinates.message);
        setSubmitting(false);
        return;
      }
      const response =
        mode === 'register'
          ? await authApi.register({
              email,
              password,
              accountType,
              ...(accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE'
                ? {
                    organizationName,
                    location: coordinates?.ok ? coordinates.value : undefined,
                  }
                : {}),
            })
          : await authApi.login({ email, password });
      session.acceptUser(response.user);

      const requestedNext = new URLSearchParams(window.location.search).get(
        'next',
      );
      const safeNext = safePostAuthPath(response.user, requestedNext);
      router.replace(safeNext);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unexpected error',
      );
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <form className="card" onSubmit={handleSubmit}>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="field">
          {mode === 'register' ? (
            <>
              <label htmlFor="account-type">Account type</label>
              <select
                id="account-type"
                value={accountType}
                onChange={(event) =>
                  setAccountType(
                    event.target.value as
                      'INDIVIDUAL' | 'HOSPITAL' | 'BLOOD_CENTRE' | 'ADMIN',
                  )
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="BLOOD_CENTRE">Blood bank</option>
                <option value="ADMIN">Admin</option>
              </select>
            </>
          ) : null}
        </div>
        {mode === 'register' &&
        (accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE') ? (
          <div className="field">
            <label htmlFor="organization-name">Organization name</label>
            <input
              id="organization-name"
              required
              maxLength={255}
              autoComplete="organization"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />
          </div>
        ) : null}
        {mode === 'register' &&
        (accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE') ? (
          <fieldset className="field">
            <legend>Organization location</legend>
            <p className="muted">
              Coordinates help people find this organization. Enter its
              location or use the device location while at the organization.
            </p>
            <div className="row">
              <label htmlFor="organization-latitude">Latitude</label>
              <input
                id="organization-latitude"
                type="number"
                required
                min={-90}
                max={90}
                step="any"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
              <label htmlFor="organization-longitude">Longitude</label>
              <input
                id="organization-longitude"
                type="number"
                required
                min={-180}
                max={180}
                step="any"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={locating}
              onClick={async () => {
                setLocationError(null);
                if (!navigator.geolocation) {
                  setLocationError(
                    'This browser does not provide location access. Enter coordinates manually.',
                  );
                  return;
                }
                setLocating(true);
                try {
                  const position = await requestBrowserCoordinates(
                    navigator.geolocation,
                  );
                  setLatitude(String(position.latitude));
                  setLongitude(String(position.longitude));
                } catch (locationFailure) {
                  setLocationError(
                    locationFailure instanceof Error
                      ? locationFailure.message
                      : 'Could not determine the organization location.',
                  );
                } finally {
                  setLocating(false);
                }
              }}
            >
              {locating ? 'Getting location…' : 'Use this device location'}
            </button>
            {locationError ? (
              <p className="alert error" role="alert">
                {locationError}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="row">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting
              ? 'Working…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login'
              ? 'Need an account? Register'
              : 'Have an account? Sign in'}
          </button>
        </div>
        {mode === 'register' ? (
          <p className="muted">
            Choose your account type once. Hospital and blood bank accounts
            create an organization workspace.
          </p>
        ) : null}
        {mode === 'register' && accountType === 'ADMIN' ? (
          <p className="muted" role="note">
            Admin accounts can view platform metrics and current account and
            organization records. This public form allows anyone to create an
            Admin account.
          </p>
        ) : null}
      </form>
    </main>
  );
}
