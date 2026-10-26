'use client';

import { useState } from 'react';
import { ApiClientError } from '@/api/client';
import * as authApi from '@/api/auth';
import { useAuthSession } from '../auth-session';

export default function ProfilePage() {
  const { user, acceptUser } = useAuthSession();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updatedUser = await authApi.updateAccountName({
        name: name.trim(),
      });
      acceptUser(updatedUser);
      setName(updatedUser.name ?? '');
      setNotice('Your name has been updated.');
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Could not update your name.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <h1>Your account</h1>
      <form className="card" onSubmit={(event) => void save(event)}>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            required
          />
        </div>
        <p className="muted">Account email: {user?.email}</p>
        {error ? <p className="alert error">{error}</p> : null}
        {notice ? <p className="alert success">{notice}</p> : null}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </main>
  );
}
