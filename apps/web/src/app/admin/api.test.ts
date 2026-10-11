import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { API_BASE_URL } from '../../api/client.ts';
import { adminApi } from './api.ts';

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

(globalThis as Record<string, unknown>).window = {
  sessionStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};
(globalThis as Record<string, unknown>).fetch = async (
  url: string,
  init: RequestInit,
) => {
  calls.push({ url, init });
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: [] }),
  };
};

beforeEach(() => {
  calls = [];
});

test('admin views use the protected metrics and paginated current-record endpoints', async () => {
  await adminApi.getMetrics();
  await adminApi.listAccounts(2);
  await adminApi.listOrganizations(3);

  assert.equal(calls[0].url, `${API_BASE_URL}/admin/metrics`);
  assert.equal(
    calls[1].url,
    `${API_BASE_URL}/admin/accounts?page=2&pageSize=20`,
  );
  assert.equal(
    calls[2].url,
    `${API_BASE_URL}/admin/organizations?page=3&pageSize=20`,
  );
});
