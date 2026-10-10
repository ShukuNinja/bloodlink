/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D3
 * PURPOSE: End-to-end behavior for hospital PatientNeed review, the official
 * BloodRequest lifecycle, responder assignments, and fulfillment.
 * ENDPOINT/METHOD: GET /hospital/patient-needs[/:id], POST :id/verify,
 * POST :id/reject, GET /blood-requests[/:id][/responses], POST cancel,
 * responder select/standby/release, fulfillment start/confirm.
 * INPUT: Authenticated HTTP requests against the compiled Nest application.
 * OUTPUT: Verified membership scoping, review transitions, transactional
 * single-BloodRequest creation, lifecycle gates, assignment rules, and the
 * D4 read-only boundary.
 * AUTHORIZATION: Authenticated HOSPITAL_ADMIN/HOSPITAL_STAFF with an ACTIVE
 * membership in an ACTIVE HOSPITAL; ownership enforced server-side.
 * DEPENDENCIES: AppModule, PrismaService override backed by an in-memory
 * relational store that emulates the Prisma calls the repositories issue.
 * STATE CHANGES: In-memory only.
 * NON-RESPONSIBILITIES: PostGIS verification; D4 response lifecycle (D4
 * response rows are seeded as fixtures and asserted immutable).
 */

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { PrismaService } = require('../dist/database/prisma.service');
const { configureApi } = require('../dist/http/configure-api');

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.DATABASE_URL ??=
  'postgresql://bloodlink_test:bloodlink_test@127.0.0.1:5432/bloodlink_test?schema=public';
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-also-over-32-characters';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';

let app;
let baseUrl;
let store;
let hannaToken; // HOSPITAL_ADMIN @ City
let samToken; // HOSPITAL_STAFF @ City
let noraToken; // HOSPITAL_ADMIN @ North
let ivyToken; // INDIVIDUAL
let rexToken; // blood-centre staff only (no hospital role)
let cityHospitalId;
let northHospitalId;
let riverCentreId;

before(async () => {
  const { AppModule } = require('../dist/app.module');
  store = new MemoryD3Store();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(store)
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  configureApi(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();

  cityHospitalId = randomUUID();
  northHospitalId = randomUUID();
  riverCentreId = randomUUID();
  store.organizations.push(
    {
      id: cityHospitalId,
      name: 'City Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
    },
    {
      id: northHospitalId,
      name: 'North Hospital',
      type: 'HOSPITAL',
      status: 'ACTIVE',
    },
    {
      id: riverCentreId,
      name: 'River Blood Centre',
      type: 'BLOOD_CENTRE',
      status: 'ACTIVE',
    },
  );

  hannaToken = await registerAndLogin('hanna@city.example.com');
  samToken = await registerAndLogin('sam@city.example.com');
  noraToken = await registerAndLogin('nora@north.example.com');
  ivyToken = await registerAndLogin('ivy@individual.example.com');
  rexToken = await registerAndLogin('rex@centre.example.com');

  const userIds = {};
  for (const user of store.users) userIds[user.email] = user.id;

  store.organizationMemberships.push(
    membership(
      userIds['hanna@city.example.com'],
      cityHospitalId,
      'HOSPITAL_ADMIN',
    ),
    membership(
      userIds['sam@city.example.com'],
      cityHospitalId,
      'HOSPITAL_STAFF',
    ),
    membership(
      userIds['nora@north.example.com'],
      northHospitalId,
      'HOSPITAL_ADMIN',
    ),
    membership(
      userIds['rex@centre.example.com'],
      riverCentreId,
      'BLOOD_CENTRE_STAFF',
    ),
  );
});

after(async () => {
  await app?.close();
});

describe('D3 hospital PatientNeed review', () => {
  it('lists PatientNeeds only for the authenticated user hospital memberships', async () => {
    const cityNeed = await createNeed(ivyToken, cityHospitalId);
    const northNeed = await createNeed(ivyToken, northHospitalId);

    const hannaList = await (
      await authed(hannaToken, '/hospital/patient-needs')
    ).json();
    const hannaIds = hannaList.data.map((need) => need.id);
    assert.ok(hannaIds.includes(cityNeed.id));
    assert.ok(!hannaIds.includes(northNeed.id));
    assert.equal(hannaList.meta.page, 1);
    assert.equal(hannaList.meta.pageSize, 20);
    assert.ok(hannaList.meta.total >= 1);

    const noraList = await (
      await authed(noraToken, '/hospital/patient-needs')
    ).json();
    const noraIds = noraList.data.map((need) => need.id);
    assert.ok(noraIds.includes(northNeed.id));
    assert.ok(!noraIds.includes(cityNeed.id));

    const filtered = await (
      await authed(
        hannaToken,
        `/hospital/patient-needs?status=PENDING_HOSPITAL_REVIEW`,
      )
    ).json();
    assert.ok(
      filtered.data.every((need) => need.status === 'PENDING_HOSPITAL_REVIEW'),
    );

    // HOSPITAL_STAFF (not only HOSPITAL_ADMIN) can review its own hospital.
    const samList = await (
      await authed(samToken, '/hospital/patient-needs')
    ).json();
    const samIds = samList.data.map((need) => need.id);
    assert.ok(samIds.includes(cityNeed.id));
    assert.ok(!samIds.includes(northNeed.id));
  });

  it('denies access to a PatientNeed owned by another hospital', async () => {
    const northNeed = await createNeed(ivyToken, northHospitalId);

    const response = await authed(
      hannaToken,
      `/hospital/patient-needs/${northNeed.id}`,
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  });

  it('transitions PENDING_HOSPITAL_REVIEW to VERIFIED', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);

    const response = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hannaToken,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.patientNeed.status, 'VERIFIED');
    assert.equal(body.data.patientNeed.id, need.id);

    const reloaded = await (
      await authed(hannaToken, `/hospital/patient-needs/${need.id}`)
    ).json();
    assert.equal(reloaded.data.status, 'VERIFIED');
  });

  it('transitions PENDING_HOSPITAL_REVIEW to REJECTED', async () => {
    const need = await createNeed(ivyToken, northHospitalId);

    const response = await post(
      `/hospital/patient-needs/${need.id}/reject`,
      noraToken,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'REJECTED');
  });

  it('cannot verify a CANCELLED PatientNeed', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    assert.equal(
      (await post(`/patient-needs/${need.id}/cancel`, ivyToken)).status,
      200,
    );

    const response = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hannaToken,
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'CONFLICT');
  });

  it('cannot verify a REJECTED PatientNeed', async () => {
    const need = await createNeed(ivyToken, northHospitalId);
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/reject`, noraToken))
        .status,
      200,
    );

    const response = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      noraToken,
    );
    assert.equal(response.status, 409);
  });

  it('cannot reject a VERIFIED PatientNeed', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken))
        .status,
      200,
    );

    const response = await post(
      `/hospital/patient-needs/${need.id}/reject`,
      hannaToken,
    );
    assert.equal(response.status, 409);
  });

  it('does not alter D2 cancellation behavior', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);

    // D2: the owner can still cancel a pending need.
    const cancel = await post(`/patient-needs/${need.id}/cancel`, ivyToken);
    assert.equal(cancel.status, 200);
    assert.equal((await cancel.json()).data.status, 'CANCELLED');

    // Individuals cannot reach the hospital review routes.
    assert.equal(
      (await authed(ivyToken, '/hospital/patient-needs')).status,
      403,
    );
    // Blood-centre membership is not a hospital role.
    assert.equal(
      (await authed(rexToken, '/hospital/patient-needs')).status,
      403,
    );
    // Unauthenticated requests keep the canonical 401 envelope.
    assert.equal(
      (await fetch(`${baseUrl}/api/v1/hospital/patient-needs`)).status,
      401,
    );
  });
});

describe('D3 BloodRequest lifecycle', () => {
  it('verification creates exactly one BloodRequest transactionally', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    const baseline = store.bloodRequests.length;

    const response = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hannaToken,
    );
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(store.bloodRequests.length, baseline + 1);
    const created = body.data.bloodRequest;
    assert.equal(created.patientNeedId, need.id);
    assert.equal(created.status, 'OPEN');
    assert.equal(created.bloodGroup, need.bloodGroup);
    assert.equal(created.component, need.component);
    assert.equal(created.unitsRequired, need.units);
    assert.equal(created.urgency, need.urgency);
    assert.equal(created.requiredBy, need.requiredBy);
  });

  it('duplicate verification cannot create a second BloodRequest', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken))
        .status,
      200,
    );
    const afterFirst = store.bloodRequests.length;

    const repeat = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hannaToken,
    );
    assert.equal(repeat.status, 409);
    assert.equal((await repeat.json()).error.code, 'CONFLICT');
    assert.equal(store.bloodRequests.length, afterFirst);
  });

  it('does not expose a direct individual BloodRequest creation route', async () => {
    assert.equal((await post('/blood-requests', ivyToken, {})).status, 404);
    assert.equal((await post('/blood-requests', hannaToken, {})).status, 404);
    // Individuals are also denied the hospital request list entirely.
    assert.equal((await authed(ivyToken, '/blood-requests')).status, 403);
  });

  it('creates a BloodRequest for the PatientNeed hospital', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);

    // North staff cannot act on City needs at all.
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, noraToken))
        .status,
      404,
    );

    const body = await (
      await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken)
    ).json();
    assert.equal(body.data.bloodRequest.hospitalId, cityHospitalId);
  });

  it('rejects invalid BloodRequest lifecycle transitions', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    const verifyBody = await (
      await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken)
    ).json();
    const requestId = verifyBody.data.bloodRequest.id;

    // OPEN with no selected responder: fulfillment cannot start.
    assert.equal(
      (await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken))
        .status,
      409,
    );
    // Confirmation requires FULFILLMENT_PENDING.
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/fulfillment/confirm`,
          hannaToken,
        )
      ).status,
      409,
    );
    // Invalid identifiers use the canonical 400 envelope.
    assert.equal(
      (await authed(hannaToken, '/blood-requests/not-a-uuid')).status,
      400,
    );
  });

  it('allows cancellation before fulfillment begins', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    const verifyBody = await (
      await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken)
    ).json();
    const requestId = verifyBody.data.bloodRequest.id;

    const response = await post(
      `/blood-requests/${requestId}/cancel`,
      hannaToken,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, 'CANCELLED');

    const reloaded = await (
      await authed(hannaToken, `/blood-requests/${requestId}`)
    ).json();
    assert.equal(reloaded.data.status, 'CANCELLED');
    // Repeat cancellation is a conflict.
    assert.equal(
      (await post(`/blood-requests/${requestId}/cancel`, hannaToken)).status,
      409,
    );
  });

  it('rejects cancellation after fulfillment begins', async () => {
    const { requestId } =
      await verifyRequestWithSelectedResponder(cityHospitalId);
    assert.equal(
      (await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken))
        .status,
      200,
    );

    const response = await post(
      `/blood-requests/${requestId}/cancel`,
      hannaToken,
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'CONFLICT');
  });

  it('denies cancellation by an unauthorized hospital', async () => {
    const need = await createNeed(ivyToken, cityHospitalId);
    const verifyBody = await (
      await post(`/hospital/patient-needs/${need.id}/verify`, hannaToken)
    ).json();
    const requestId = verifyBody.data.bloodRequest.id;

    assert.equal(
      (await post(`/blood-requests/${requestId}/cancel`, noraToken)).status,
      404,
    );
    assert.equal(
      (await authed(noraToken, `/blood-requests/${requestId}`)).status,
      404,
    );
  });
});

describe('D3 responder assignment boundary', () => {
  it('can select an accepted D4 response', async () => {
    const { requestId } = await verifyRequestWithAcceptedResponses(
      cityHospitalId,
      { donor: 'ACCEPTED', extraDonor: 'NOTIFIED' },
    );
    const responseRow = store.donorResponses.find(
      (row) => row.bloodRequestId === requestId && row.status === 'ACCEPTED',
    );

    const response = await post(
      `/blood-requests/${requestId}/responders/${responseRow.id}/select`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    assert.equal(response.status, 200);
    const view = (await response.json()).data;
    assert.equal(view.state, 'SELECTED');
    assert.equal(view.response.responseId, responseRow.id);
    assert.equal(view.response.responseType, 'DONOR_RESPONSE');

    // Selecting covers the request.
    const detail = await (
      await authed(hannaToken, `/blood-requests/${requestId}`)
    ).json();
    assert.equal(detail.data.status, 'COVERED');
    assert.equal(detail.data.assignments.length, 1);

    // Non-accepted responses cannot be selected.
    const notified = store.donorResponses.find(
      (row) => row.bloodRequestId === requestId && row.status === 'NOTIFIED',
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/responders/${notified.id}/select`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      409,
    );
  });

  it('can place an accepted D4 response on standby', async () => {
    const { requestId, organizationResponseId } =
      await verifyRequestWithAcceptedResponses(cityHospitalId, {
        organization: 'ACCEPTED',
      });

    const response = await post(
      `/blood-requests/${requestId}/responders/${organizationResponseId}/standby`,
      hannaToken,
      { responseType: 'ORGANIZATION_RESPONSE' },
    );
    assert.equal(response.status, 200);
    const view = (await response.json()).data;
    assert.equal(view.state, 'STANDBY');
    assert.equal(view.response.responseType, 'ORGANIZATION_RESPONSE');
  });

  it('can release a selected responder', async () => {
    const { requestId, donorResponseId } =
      await verifyRequestWithAcceptedResponses(cityHospitalId, {
        donor: 'ACCEPTED',
      });
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/responders/${donorResponseId}/select`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      200,
    );

    const response = await post(
      `/blood-requests/${requestId}/responders/${donorResponseId}/release`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    assert.equal(response.status, 200);
    const view = (await response.json()).data;
    assert.equal(view.state, 'RELEASED');
    assert.ok(view.releasedAt);

    // The released responder's D4 response is still ACCEPTED (D3 never
    // mutates it), so coverage reopens to RESPONSES_RECEIVED, not OPEN.
    const detail = await (
      await authed(hannaToken, `/blood-requests/${requestId}`)
    ).json();
    assert.equal(detail.data.status, 'RESPONSES_RECEIVED');

    // When no accepted responses remain (the D4 side withdrew between
    // selection and release), coverage reopens fully to OPEN.
    const reopened = await verifyRequestWithAcceptedResponses(cityHospitalId, {
      donor: 'ACCEPTED',
    });
    await post(
      `/blood-requests/${reopened.requestId}/responders/${reopened.donorResponseId}/select`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    const withdrawn = store.donorResponses.find(
      (row) => row.id === reopened.donorResponseId,
    );
    withdrawn.status = 'WITHDRAWN'; // simulate a D4-side withdrawal
    assert.equal(
      (
        await post(
          `/blood-requests/${reopened.requestId}/responders/${reopened.donorResponseId}/release`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      200,
    );
    const reopenedDetail = await (
      await authed(hannaToken, `/blood-requests/${reopened.requestId}`)
    ).json();
    assert.equal(reopenedDetail.data.status, 'OPEN');

    // Releasing twice is a conflict.
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/responders/${donorResponseId}/release`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      409,
    );
  });

  it('can promote standby through selection', async () => {
    const { requestId, donorResponseId } =
      await verifyRequestWithAcceptedResponses(cityHospitalId, {
        donor: 'ACCEPTED',
      });
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/responders/${donorResponseId}/standby`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      200,
    );

    const response = await post(
      `/blood-requests/${requestId}/responders/${donorResponseId}/select`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.state, 'SELECTED');
  });

  it('rejects a response associated with another BloodRequest', async () => {
    const first = await verifyRequestWithAcceptedResponses(cityHospitalId, {
      donor: 'ACCEPTED',
    });
    const second = await verifyRequestWithAcceptedResponses(cityHospitalId, {
      donor: 'ACCEPTED',
    });
    const foreignResponse = store.donorResponses.find(
      (row) => row.bloodRequestId === second.requestId,
    );

    const response = await post(
      `/blood-requests/${first.requestId}/responders/${foreignResponse.id}/select`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  });

  it('does not mutate D4 response state', async () => {
    const { requestId, donorResponseId } =
      await verifyRequestWithAcceptedResponses(cityHospitalId, {
        donor: 'ACCEPTED',
      });
    const snapshot = JSON.stringify(store.donorResponses);

    await post(
      `/blood-requests/${requestId}/responders/${donorResponseId}/select`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );
    await post(
      `/blood-requests/${requestId}/responders/${donorResponseId}/release`,
      hannaToken,
      { responseType: 'DONOR_RESPONSE' },
    );

    assert.equal(JSON.stringify(store.donorResponses), snapshot);
    // Response references remain readable and read-only.
    const references = await (
      await authed(hannaToken, `/blood-requests/${requestId}/responses`)
    ).json();
    assert.ok(
      references.data.some(
        (reference) =>
          reference.responseId === donorResponseId &&
          reference.responseType === 'DONOR_RESPONSE',
      ),
    );
  });
});

describe('D3 fulfillment boundary', () => {
  it('starts fulfillment only from an allowed lifecycle state', async () => {
    const { requestId } =
      await verifyRequestWithSelectedResponder(cityHospitalId);

    const response = await post(
      `/blood-requests/${requestId}/fulfillment/start`,
      hannaToken,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, 'FULFILLMENT_PENDING');

    // Starting twice is rejected.
    assert.equal(
      (await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken))
        .status,
      409,
    );
  });

  it('confirms fulfillment only from an allowed lifecycle state', async () => {
    const { requestId } =
      await verifyRequestWithSelectedResponder(cityHospitalId);
    assert.equal(
      (await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken))
        .status,
      200,
    );

    const response = await post(
      `/blood-requests/${requestId}/fulfillment/confirm`,
      hannaToken,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, 'FULFILLMENT_CONFIRMED');
  });

  it('does not transition a fulfilled request backward', async () => {
    const { requestId } =
      await verifyRequestWithSelectedResponder(cityHospitalId);
    await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken);
    await post(`/blood-requests/${requestId}/fulfillment/confirm`, hannaToken);

    assert.equal(
      (await post(`/blood-requests/${requestId}/fulfillment/start`, hannaToken))
        .status,
      409,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/fulfillment/confirm`,
          hannaToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (await post(`/blood-requests/${requestId}/cancel`, hannaToken)).status,
      409,
    );
    // Assignments are also locked once fulfillment is confirmed.
    const responseRow = store.donorResponses.find(
      (row) => row.bloodRequestId === requestId,
    );
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/responders/${responseRow.id}/select`,
          hannaToken,
          { responseType: 'DONOR_RESPONSE' },
        )
      ).status,
      409,
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(email) {
  const password = 'a-safe-test-password';
  const registerResponse = await post('/auth/register', null, {
    email,
    password,
  });
  assert.equal(registerResponse.status, 201);

  const loginResponse = await post('/auth/login', null, { email, password });
  assert.equal(loginResponse.status, 200);
  return (await loginResponse.json()).data.accessToken;
}

function authed(token, path) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function post(path, token, body) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

function membership(userId, organizationId, role) {
  return {
    id: randomUUID(),
    userId,
    organizationId,
    role,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function createNeed(token, hospitalId) {
  const payload = {
    hospitalId,
    bloodGroup: 'A_POSITIVE',
    component: 'WHOLE_BLOOD',
    units: 2,
    urgency: 'URGENT',
    requiredBy: new Date(Date.now() + 86_400_000).toISOString(),
    additionalNotes: 'D3 review fixture',
  };
  const response = await post('/patient-needs', token, payload);
  assert.equal(response.status, 201);
  const body = await response.json();
  return { ...body.data, ...payload };
}

async function verifyNeed(token, needId) {
  const response = await post(
    `/hospital/patient-needs/${needId}/verify`,
    token,
  );
  assert.equal(response.status, 200);
  return (await response.json()).data.bloodRequest;
}

function seedDonorResponse(bloodRequestId, status) {
  const row = {
    id: randomUUID(),
    bloodRequestId,
    donorId: randomUUID(),
    status,
    respondedAt: new Date(),
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.donorResponses.push(row);
  return row;
}

function seedOrganizationResponse(bloodRequestId, status) {
  const row = {
    id: randomUUID(),
    bloodRequestId,
    organizationId: riverCentreId,
    status,
    respondedAt: new Date(),
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.organizationResponses.push(row);
  return row;
}

/**
 * Creates a verified request at the given hospital and seeds one accepted
 * donor response plus optional extras; returns the identifiers tests need.
 */
async function verifyRequestWithAcceptedResponses(hospitalId, seed) {
  const need = await createNeed(ivyToken, hospitalId);
  const bloodRequest = await verifyNeed(hannaToken, need.id);
  let donorResponseId;
  let organizationResponseId;
  if (seed.donor) {
    donorResponseId = seedDonorResponse(bloodRequest.id, seed.donor).id;
  }
  if (seed.extraDonor) {
    seedDonorResponse(bloodRequest.id, seed.extraDonor);
  }
  if (seed.organization) {
    organizationResponseId = seedOrganizationResponse(
      bloodRequest.id,
      seed.organization,
    ).id;
  }
  return {
    requestId: bloodRequest.id,
    donorResponseId,
    organizationResponseId,
  };
}

/** Verified request with an already-SELECTED responder. */
async function verifyRequestWithSelectedResponder(hospitalId) {
  const context = await verifyRequestWithAcceptedResponses(hospitalId, {
    donor: 'ACCEPTED',
  });
  const select = await post(
    `/blood-requests/${context.requestId}/responders/${context.donorResponseId}/select`,
    hannaToken,
    { responseType: 'DONOR_RESPONSE' },
  );
  assert.equal(select.status, 200);
  return context;
}

// ---------------------------------------------------------------------------
// In-memory relational store emulating the Prisma calls D3 repositories
// issue. Mirrors the D2 suite harness.
// ---------------------------------------------------------------------------

function MemoryD3Store() {
  this.users = [];
  this.refreshTokens = [];
  this.organizations = [];
  this.organizationMemberships = [];
  this.patientNeeds = [];
  this.bloodRequests = [];
  this.responderAssignments = [];
  this.donorResponses = [];
  this.organizationResponses = [];

  const matchesValue = (actual, expected) => {
    if (expected !== null && typeof expected === 'object') {
      if (Array.isArray(expected.in)) return expected.in.includes(actual);
      if (Array.isArray(expected.notIn))
        return !expected.notIn.includes(actual);
      return false;
    }
    return actual === expected;
  };

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'organization') {
        const organization = this.organizations.find(
          (candidate) => candidate.id === row.organizationId,
        );
        return (
          Boolean(organization) &&
          Object.entries(value).every(([orgKey, orgValue]) =>
            matchesValue(organization[orgKey], orgValue),
          )
        );
      }
      return matchesValue(row[key], value);
    });

  const sortRows = (rows, orderByInput = []) => {
    const orderBy = Array.isArray(orderByInput)
      ? orderByInput
      : orderByInput
        ? [orderByInput]
        : [];
    let sorted = [...rows];
    for (const rule of [...orderBy].reverse()) {
      const [field, direction] = Object.entries(rule)[0];
      sorted = [...sorted].sort((a, b) => {
        const left = a[field];
        const right = b[field];
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return direction === 'desc' ? -comparison : comparison;
      });
    }
    return sorted;
  };

  const patientNeedDelegate = {
    create: async ({ data }) => {
      const row = {
        id: randomUUID(),
        status: 'PENDING_HOSPITAL_REVIEW',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.patientNeeds.push(row);
      return { ...row };
    },
    findFirst: async ({ where }) => {
      const row = this.patientNeeds.find((need) => matches(need, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [], skip = 0, take }) => {
      const rows = sortRows(
        this.patientNeeds.filter((need) => matches(need, where)),
        orderBy,
      );
      const limited = take === undefined ? rows : rows.slice(skip, skip + take);
      return limited.map((row) => ({ ...row }));
    },
    count: async ({ where }) =>
      this.patientNeeds.filter((need) => matches(need, where)).length,
    findUnique: async ({ where }) => {
      const row = this.patientNeeds.find((need) => matches(need, where));
      return row ? { ...row } : null;
    },
    findUniqueOrThrow: async ({ where }) => {
      const row = this.patientNeeds.find((need) => matches(need, where));
      if (!row) throw { code: 'P2025' };
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of this.patientNeeds) {
        if (matches(row, where)) {
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
  };
  this.patientNeed = patientNeedDelegate;

  const bloodRequestDelegate = {
    create: async ({ data }) => {
      if (
        this.bloodRequests.some(
          (request) => request.patientNeedId === data.patientNeedId,
        )
      ) {
        throw { code: 'P2002' };
      }
      const row = {
        id: randomUUID(),
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.bloodRequests.push(row);
      return { ...row };
    },
    findFirst: async ({ where }) => {
      const row = this.bloodRequests.find((request) => matches(request, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [], skip = 0, take }) => {
      const rows = sortRows(
        this.bloodRequests.filter((request) => matches(request, where)),
        orderBy,
      );
      const limited = take === undefined ? rows : rows.slice(skip, skip + take);
      return limited.map((row) => ({ ...row }));
    },
    count: async ({ where }) =>
      this.bloodRequests.filter((request) => matches(request, where)).length,
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of this.bloodRequests) {
        if (matches(row, where)) {
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
  };
  this.bloodRequest = bloodRequestDelegate;

  const responderAssignmentDelegate = {
    create: async ({ data }) => {
      const row = {
        id: randomUUID(),
        donorResponseId: null,
        organizationResponseId: null,
        assignedAt: new Date(),
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.responderAssignments.push(row);
      return { ...row };
    },
    findFirst: async ({ where }) => {
      const row = this.responderAssignments.find((assignment) =>
        matches(assignment, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        this.responderAssignments.filter((assignment) =>
          matches(assignment, where),
        ),
        orderBy,
      ).map((row) => ({ ...row })),
    update: async ({ where, data }) => {
      const row = this.responderAssignments.find(
        (assignment) => assignment.id === where.id,
      );
      if (!row) throw { code: 'P2025' };
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of this.responderAssignments) {
        if (matches(row, where)) {
          Object.assign(row, data, { updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
  };
  this.responderAssignment = responderAssignmentDelegate;

  const responseDelegate = (collection) => ({
    findFirst: async ({ where }) => {
      const row = collection.find((response) => matches(response, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy = [] }) =>
      sortRows(
        collection.filter((response) => matches(response, where)),
        orderBy,
      ).map((row) => ({ ...row })),
    count: async ({ where }) =>
      collection.filter((response) => matches(response, where)).length,
  });
  this.donorResponse = responseDelegate(this.donorResponses);
  this.organizationResponse = responseDelegate(this.organizationResponses);

  this.organization = {
    findUnique: async ({ where }) => {
      const organization = this.organizations.find(
        (candidate) => candidate.id === where.id,
      );
      return organization ? { ...organization } : null;
    },
  };

  this.organizationMembership = {
    findFirst: async ({ where }) => {
      const row = this.organizationMemberships.find((item) =>
        matches(item, where),
      );
      return row ? { ...row } : null;
    },
    findMany: async ({ where }) =>
      this.organizationMemberships
        .filter((item) => matches(item, where))
        .map((row) => ({ ...row })),
  };

  this.user = {
    findUnique: async ({ where }) =>
      this.users.find(
        (user) => user.id === where.id || user.email === where.email,
      ) ?? null,
    create: async ({ data }) => {
      if (this.users.some((user) => user.email === data.email)) {
        throw { code: 'P2002' };
      }
      const user = {
        id: randomUUID(),
        role: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.users.push(user);
      return user;
    },
  };

  this.refreshToken = {
    create: async ({ data }) => {
      const token = {
        id: randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      this.refreshTokens.push(token);
      return token;
    },
    findUnique: async ({ where, include }) => {
      const token = this.refreshTokens.find(
        (item) => item.tokenHash === where.tokenHash,
      );
      if (!token) return null;
      return include?.user
        ? {
            ...token,
            user: this.users.find((user) => user.id === token.userId),
          }
        : token;
    },
    updateMany: async ({ where, data }) => {
      const token = this.refreshTokens.find(
        (item) =>
          item.id === where.id &&
          (!Object.hasOwn(where, 'revokedAt') ||
            item.revokedAt === where.revokedAt) &&
          (!where.expiresAt?.gt || item.expiresAt > where.expiresAt.gt),
      );
      if (!token) return { count: 0 };
      Object.assign(token, data);
      return { count: 1 };
    },
    deleteMany: async ({ where }) => {
      const originalCount = this.refreshTokens.length;
      this.refreshTokens = this.refreshTokens.filter(
        (item) =>
          !(where.OR ?? []).some(
            (condition) =>
              (condition.revokedAt?.not === null && item.revokedAt !== null) ||
              (condition.expiresAt?.lte &&
                item.expiresAt <= condition.expiresAt.lte),
          ),
      );
      return { count: originalCount - this.refreshTokens.length };
    },
  };

  this.$transaction = async (argument) => {
    if (Array.isArray(argument)) return Promise.all(argument);
    return argument({
      patientNeed: patientNeedDelegate,
      bloodRequest: bloodRequestDelegate,
      responderAssignment: responderAssignmentDelegate,
      organization: this.organization,
      user: this.user,
    });
  };

  this.verifyConnection = async () => {};
}
