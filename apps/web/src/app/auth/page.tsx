'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/api/client';
import * as authApi from '@/api/auth';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'register') {
        await authApi.register({ email, password });
      } else {
        await authApi.login({ email, password });
      }
      router.push('/hospitals');
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
        <p className="muted">
          Individual accounts submit patient needs and browse nearby hospitals.
        </p>
      </form>
    </main>
  );
}
