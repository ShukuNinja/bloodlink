/**
 * OWNER: D2
 * PURPOSE: Unit coverage for the mobile API transport: request serialization,
 * authentication header handling, response-envelope parsing, and error
 * parsing against the canonical API error contract.
 * Runs with the built-in node test runner (no extra dependencies).
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  ApiClientError,
  API_BASE_URL,
  buildApiUrl,
  apiRequest,
  clearAccessToken,
  getAccessToken,
  resetSessionMemoryForTesting,
  setAccessToken,
  setSessionTokens,
  restoreSession,
  validationIssues,
} from './client.ts';
import { setSessionStorageAdapterForTesting } from './session-storage.ts';

type FetchCall = { url: string; init: RequestInit };

let fetchCalls: FetchCall[] = [];
let nextResponse: { status: number; body: string } = {
  status: 200,
  body: '{}',
};
let responseQueue: Array<{ status: number; body: string }> = [];
let storedSession: string | null = null;
let failNetwork = false;

const testSessionStorage = {
  getItemAsync: async () => storedSession,
  setItemAsync: async (_key: string, value: string) => {
    storedSession = value;
  },
  deleteItemAsync: async () => {
    storedSession = null;
  },
};

(globalThis as Record<string, unknown>).fetch = async (
  url: string,
  init: RequestInit,
) => {
  fetchCalls.push({ url, init });
  if (failNetwork) throw new Error('ECONNREFUSED');
  const response = responseQueue.shift() ?? nextResponse;
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    text: async () => response.body,
  };
};

beforeEach(async () => {
  fetchCalls = [];
  responseQueue = [];
  storedSession = null;
  failNetwork = false;
  nextResponse = { status: 200, body: '{}' };
  setSessionStorageAdapterForTesting(testSessionStorage);
  resetSessionMemoryForTesting();
  await clearAccessToken();
});

test('buildApiUrl serializes only defined query values', () => {
  assert.equal(buildApiUrl('/hospitals'), `${API_BASE_URL}/hospitals`);
  assert.equal(
    buildApiUrl('/hospitals', {
      latitude: 6.5,
      longitude: 3.4,
      radiusMeters: undefined,
      query: 'city',
    }),
    `${API_BASE_URL}/hospitals?latitude=6.5&longitude=3.4&query=city`,
  );
  assert.equal(
    buildApiUrl('/patient-needs', { page: 2, pageSize: 10 }),
    `${API_BASE_URL}/patient-needs?page=2&pageSize=10`,
  );
});

test('GET requests attach the bearer token and parse the success envelope', async () => {
  setAccessToken('token-abc');
  nextResponse = {
    status: 200,
    body: JSON.stringify({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
  };

  const envelope = await apiRequest<{ data: unknown[] }>(
    'GET',
    '/patient-needs',
    {
      query: { page: 1 },
    },
  );

  assert.deepEqual(envelope.data, []);
  const call = fetchCalls[0];
  assert.equal(call.url, `${API_BASE_URL}/patient-needs?page=1`);
  assert.equal(call.init.method, 'GET');
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer token-abc');
  assert.equal(headers['Content-Type'], undefined);
});

test('POST requests serialize JSON bodies with the correct content type', async () => {
  nextResponse = {
    status: 201,
    body: JSON.stringify({ data: { id: 'pn-1' } }),
  };

  const envelope = await apiRequest<{ data: { id: string } }>(
    'POST',
    '/patient-needs',
    { body: { hospitalId: 'h-1', units: 2 } },
  );

  assert.equal(envelope.data.id, 'pn-1');
  const call = fetchCalls[0];
  assert.equal(call.init.method, 'POST');
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(getAccessToken(), null, 'no token attached when signed out');
  assert.deepEqual(JSON.parse(String(call.init.body)), {
    hospitalId: 'h-1',
    units: 2,
  });
});

test('error responses become ApiClientError with canonical code and details', async () => {
  nextResponse = {
    status: 400,
    body: JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { issues: [{ path: ['units'], code: 'too_small' }] },
      },
    }),
  };

  await assert.rejects(
    apiRequest('POST', '/patient-needs', { body: {} }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.equal(error.isUnauthorized, false);
      assert.deepEqual(validationIssues(error), [
        { path: 'units', code: 'too_small' },
      ]);
      return true;
    },
  );
});

test('401 responses are flagged as unauthorized', async () => {
  nextResponse = {
    status: 401,
    body: JSON.stringify({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    }),
  };

  await assert.rejects(
    apiRequest('GET', '/patient-needs'),
    (error: unknown) => error instanceof ApiClientError && error.isUnauthorized,
  );
});

for (const [status, code] of [
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [500, 'INTERNAL_ERROR'],
] as const) {
  test(`${status} ${code} envelopes are surfaced without leaking internals`, async () => {
    nextResponse = {
      status,
      body: JSON.stringify({ error: { code, message: 'Safe message' } }),
    };

    await assert.rejects(
      apiRequest('GET', '/patient-needs/x'),
      (error: unknown) =>
        error instanceof ApiClientError &&
        error.status === status &&
        error.code === code &&
        error.message === 'Safe message',
    );
  });
}

test('network failures map to NETWORK_ERROR', async () => {
  failNetwork = true;

  await assert.rejects(
    apiRequest('GET', '/hospitals', { query: { latitude: 1, longitude: 2 } }),
    (error: unknown) =>
      error instanceof ApiClientError && error.code === 'NETWORK_ERROR',
  );
});

test('malformed error bodies do not crash parsing', async () => {
  nextResponse = { status: 502, body: '<html>bad gateway</html>' };

  await assert.rejects(
    apiRequest('GET', '/patient-needs'),
    (error: unknown) =>
      error instanceof ApiClientError && error.code === 'MALFORMED',
  );
});

test('access token memory set/get/clear round-trip', async () => {
  assert.equal(getAccessToken(), null);
  setAccessToken('token-xyz');
  assert.equal(getAccessToken(), 'token-xyz');
  await clearAccessToken();
  assert.equal(getAccessToken(), null);
});

test('persists and restores both tokens after an app restart', async () => {
  await setSessionTokens('access-before-restart', 'refresh-before-restart');
  assert.deepEqual(JSON.parse(String(storedSession)), {
    accessToken: 'access-before-restart',
    refreshToken: 'refresh-before-restart',
  });

  resetSessionMemoryForTesting();
  await restoreSession();
  assert.equal(getAccessToken(), 'access-before-restart');
});

test('refreshes and persists rotated tokens once after an expired access token', async () => {
  await setSessionTokens('expired-access', 'refresh-current');
  responseQueue = [
    {
      status: 401,
      body: JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }),
    },
    {
      status: 200,
      body: JSON.stringify({
        data: {
          accessToken: 'access-rotated',
          refreshToken: 'refresh-rotated',
        },
      }),
    },
    { status: 200, body: JSON.stringify({ data: { id: 'need-1' } }) },
  ];

  const result = await apiRequest<{ data: { id: string } }>(
    'GET',
    '/patient-needs',
  );

  assert.equal(result.data.id, 'need-1');
  assert.equal(fetchCalls.length, 3);
  assert.equal(
    (fetchCalls[2].init.headers as Record<string, string>).Authorization,
    'Bearer access-rotated',
  );
  assert.deepEqual(JSON.parse(String(storedSession)), {
    accessToken: 'access-rotated',
    refreshToken: 'refresh-rotated',
  });
});

test('expired refresh token clears the persisted session', async () => {
  await setSessionTokens('expired-access', 'expired-refresh');
  responseQueue = [
    {
      status: 401,
      body: JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }),
    },
    {
      status: 401,
      body: JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }),
    },
  ];

  await assert.rejects(
    apiRequest('GET', '/patient-needs'),
    (error: unknown) =>
      error instanceof ApiClientError && error.code === 'UNAUTHORIZED',
  );
  assert.equal(storedSession, null);
  assert.equal(getAccessToken(), null);
});
