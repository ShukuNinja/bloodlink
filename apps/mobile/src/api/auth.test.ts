import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signOut } from './auth.ts';
import {
  clearAccessToken,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
  subscribeToSessionChanges,
} from './client.ts';

test('sign-out clears local access and refresh credentials and revokes the refresh session', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      text: async () => '{"data":{}}',
    } as Response;
  };
  setSessionTokens('access-secret', 'refresh-secret');
  let changes = 0;
  const unsubscribe = subscribeToSessionChanges(() => changes++);

  signOut();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/logout$/);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    refreshToken: 'refresh-secret',
  });
  assert.equal(changes, 1);
  unsubscribe();
  clearAccessToken();
});

test('sign-out stays local when API logout fails', async () => {
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  setSessionTokens('access-secret', 'refresh-secret');
  assert.doesNotThrow(() => signOut());
  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
});
