import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { hospitalApi } from './api.ts';
import { API_BASE_URL } from '../../api/client.ts';

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
    text: async () => JSON.stringify({ data: {} }),
  };
};

beforeEach(() => {
  calls = [];
});

test('hospital review requests use the existing D3 routes and query contract', async () => {
  await hospitalApi.listPatientNeeds({
    status: 'PENDING_HOSPITAL_REVIEW',
    page: 2,
    pageSize: 10,
  });
  await hospitalApi.getPatientNeed('need/1');
  await hospitalApi.verifyPatientNeed('need/1');
  await hospitalApi.rejectPatientNeed('need/2');

  assert.equal(
    calls[0].url,
    `${API_BASE_URL}/hospital/patient-needs?status=PENDING_HOSPITAL_REVIEW&page=2&pageSize=10`,
  );
  assert.equal(calls[1].url, `${API_BASE_URL}/hospital/patient-needs/need%2F1`);
  assert.equal(calls[2].init.method, 'POST');
  assert.equal(
    calls[2].url,
    `${API_BASE_URL}/hospital/patient-needs/need%2F1/verify`,
  );
  assert.equal(
    calls[3].url,
    `${API_BASE_URL}/hospital/patient-needs/need%2F2/reject`,
  );
});

test('BloodRequest actions stay on D3 endpoints and send the shared action payload', async () => {
  await hospitalApi.listBloodRequests({ status: 'OPEN', page: 1 });
  await hospitalApi.getBloodRequest('request-1');
  await hospitalApi.listResponses('request-1');
  await hospitalApi.cancelBloodRequest('request-1');
  await hospitalApi.selectResponder('request-1', 'response-1', {
    responseType: 'DONOR_RESPONSE',
  });
  await hospitalApi.standbyResponder('request-1', 'response-2', {
    responseType: 'ORGANIZATION_RESPONSE',
  });
  await hospitalApi.releaseResponder('request-1', 'response-2', {
    responseType: 'ORGANIZATION_RESPONSE',
  });
  await hospitalApi.startFulfillment('request-1');
  await hospitalApi.confirmFulfillment('request-1');

  assert.equal(
    calls[0].url,
    `${API_BASE_URL}/blood-requests?status=OPEN&page=1`,
  );
  assert.equal(calls[1].url, `${API_BASE_URL}/blood-requests/request-1`);
  assert.equal(
    calls[2].url,
    `${API_BASE_URL}/blood-requests/request-1/responses`,
  );
  assert.equal(calls[3].url, `${API_BASE_URL}/blood-requests/request-1/cancel`);
  assert.deepEqual(JSON.parse(String(calls[4].init.body)), {
    responseType: 'DONOR_RESPONSE',
  });
  assert.match(calls[5].url, /\/standby$/);
  assert.match(calls[6].url, /\/release$/);
  assert.equal(
    calls[7].url,
    `${API_BASE_URL}/blood-requests/request-1/fulfillment/start`,
  );
  assert.equal(
    calls[8].url,
    `${API_BASE_URL}/blood-requests/request-1/fulfillment/confirm`,
  );
});
