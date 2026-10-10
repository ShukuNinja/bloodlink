/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D2
 * PURPOSE: End-to-end behavior for the individual PatientNeed API.
 * ENDPOINT/METHOD: POST /patient-needs, GET /patient-needs,
 * GET /patient-needs/:id, POST /patient-needs/:id/cancel.
 * INPUT: Authenticated HTTP requests against the compiled Nest application.
 * OUTPUT: Verified statuses, envelopes, ownership isolation, pagination,
 * validation, cancellation lifecycle, and D3/D4 write prohibition.
 * AUTHORIZATION: Authenticated INDIVIDUAL; ownership enforced server-side.
 * DEPENDENCIES: AppModule, PrismaService override backed by an in-memory
 * relational store that emulates the Prisma calls the repositories issue.
 * STATE CHANGES: In-memory only.
 * NON-RESPONSIBILITIES: PostGIS verification (no PostGIS database is
 * available in this environment; documented as a limitation).
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
let aliceToken;
let bobToken;
let adminToken;
let cityHospitalId;
let northHospitalId;
let riverCentreId;
let closedHospitalId;

before(async () => {
  const { AppModule } = require('../dist/app.module');
  store = new MemoryD2Store();
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
  closedHospitalId = randomUUID();
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
    {
      id: closedHospitalId,
      name: 'Closed Hospital',
      type: 'HOSPITAL',
      status: 'SUSPENDED',
    },
  );

  aliceToken = await registerAndLogin('alice@example.com');
  bobToken = await registerAndLogin('bob@example.com');
  adminToken = await registerAndLogin('admin@example.com', {
    role: 'ADMIN',
  });
});

after(async () => {
  await app?.close();
});

describe('authentication and role enforcement', () => {
  it('rejects unauthenticated creation with 401 and the canonical error envelope', async () => {
    const response = await post('/patient-needs', null, validCreatePayload());

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
  });

  it('rejects non-INDIVIDUAL principals with 403 on every D2 route', async () => {
    const id = randomUUID();
    const routes = [
      () => post('/patient-needs', adminToken, validCreatePayload()),
      () => authed(adminToken, '/patient-needs'),
      () => authed(adminToken, `/patient-needs/${id}`),
      () => post(`/patient-needs/${id}/cancel`, adminToken),
    ];

    for (const call of routes) {
      const response = await call();
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    }
  });
});

describe('POST /patient-needs', () => {
  it('creates a need with server-controlled owner and initial status', async () => {
    const response = await post(
      '/patient-needs',
      aliceToken,
      validCreatePayload(),
    );

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['data']);
    const record = body.data;
    assert.match(record.id, /^[0-9a-f-]{36}$/i);
    assert.equal(record.hospitalId, cityHospitalId);
    assert.equal(record.bloodGroup, 'O_NEGATIVE');
    assert.equal(record.component, 'RED_BLOOD_CELLS');
    assert.equal(record.units, 2);
    assert.equal(record.urgency, 'URGENT');
    assert.equal(record.status, 'PENDING_HOSPITAL_REVIEW');
    assert.equal(record.additionalNotes, 'Post-surgery transfusion support');
    assert.doesNotThrow(() => new Date(record.requiredBy).toISOString());
    assert.doesNotThrow(() => new Date(record.createdAt).toISOString());
    assert.doesNotThrow(() => new Date(record.updatedAt).toISOString());

    const persisted = store.patientNeeds.find((row) => row.id === record.id);
    assert.ok(persisted);
    const aliceId = store.users.find(
      (user) => user.email === 'alice@example.com',
    ).id;
    assert.equal(persisted.submittedByUserId, aliceId);
  });

  it('never accepts a client-supplied owner identifier', async () => {
    const victimId = store.users.find(
      (user) => user.email === 'bob@example.com',
    ).id;
    const response = await post('/patient-needs', aliceToken, {
      ...validCreatePayload(),
      submittedByUserId: victimId,
      status: 'VERIFIED',
    });

    // The canonical strict schema rejects unknown keys before any write. The
    // payload is otherwise valid, so the rejection must come from the
    // unrecognized owner/status keys.
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.details.issues, [
      { path: [], code: 'unrecognized_keys' },
    ]);
    assert.equal(
      store.patientNeeds.some((row) => row.status === 'VERIFIED'),
      false,
    );
  });

  it('rejects invalid payloads with 400 and persists nothing', async () => {
    const baseline = store.patientNeeds.length;
    const cases = [
      {
        name: 'missing hospitalId',
        payload: omit(validCreatePayload(), 'hospitalId'),
      },
      {
        name: 'non-uuid hospitalId',
        payload: { ...validCreatePayload(), hospitalId: 'not-a-hospital' },
      },
      {
        name: 'unknown hospital',
        payload: { ...validCreatePayload(), hospitalId: randomUUID() },
      },
      {
        name: 'blood centre hospitalId',
        payload: { ...validCreatePayload(), hospitalId: riverCentreId },
      },
      {
        name: 'suspended hospital',
        payload: { ...validCreatePayload(), hospitalId: closedHospitalId },
      },
      {
        name: 'bad bloodGroup',
        payload: { ...validCreatePayload(), bloodGroup: 'X_POSITIVE' },
      },
      {
        name: 'bad component',
        payload: { ...validCreatePayload(), component: 'STEM_CELLS' },
      },
      { name: 'zero units', payload: { ...validCreatePayload(), units: 0 } },
      {
        name: 'fractional units',
        payload: { ...validCreatePayload(), units: 1.5 },
      },
      {
        name: 'bad urgency',
        payload: { ...validCreatePayload(), urgency: 'WHENEVER' },
      },
      {
        name: 'missing requiredBy',
        payload: omit(validCreatePayload(), 'requiredBy'),
      },
      {
        name: 'bad requiredBy',
        payload: { ...validCreatePayload(), requiredBy: 'tomorrow' },
      },
      {
        name: 'empty additionalNotes',
        payload: { ...validCreatePayload(), additionalNotes: '   ' },
      },
    ];

    for (const testCase of cases) {
      const response = await post(
        '/patient-needs',
        aliceToken,
        testCase.payload,
      );
      // LEAD DECISION D4: malformed hospitalId -> 400; well-formed UUID for a
      // missing or ineligible hospital -> 422.
      assert.equal(
        response.status,
        testCase.name === 'unknown hospital' ||
          testCase.name === 'blood centre hospitalId' ||
          testCase.name === 'suspended hospital'
          ? 422
          : 400,
        testCase.name,
      );
      const body = await response.json();
      assert.ok(body.error, testCase.name);
      assert.equal(body.error.code, 'VALIDATION_ERROR', testCase.name);
      assert.equal(
        JSON.stringify(body).includes('River Blood Centre'),
        false,
        'no organization details may leak',
      );
    }

    assert.equal(store.patientNeeds.length, baseline);
  });
});

describe('GET /patient-needs', () => {
  it('lists only the authenticated owner’s needs with pagination metadata', async () => {
    // Alice already has one need from the creation suite; add more.
    for (let index = 0; index < 4; index += 1) {
      const created = await post('/patient-needs', aliceToken, {
        ...validCreatePayload(),
        hospitalId: index % 2 === 0 ? cityHospitalId : northHospitalId,
        units: index + 1,
      });
      assert.equal(created.status, 201);
    }
    await post('/patient-needs', bobToken, validCreatePayload());

    const response = await authed(aliceToken, '/patient-needs');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['data', 'meta']);
    const aliceId = store.users.find(
      (user) => user.email === 'alice@example.com',
    ).id;
    assert.equal(body.data.length, 5);
    assert.ok(body.data.every((record) => record.id));
    assert.deepEqual(body.meta, {
      page: 1,
      pageSize: 20,
      total: 5,
      totalPages: 1,
    });
    assert.equal(
      body.data.every(
        (record) =>
          store.patientNeeds.find((row) => row.id === record.id)
            .submittedByUserId === aliceId,
      ),
      true,
    );
  });

  it('paginates deterministically and keeps total consistent', async () => {
    const pageOne = await (
      await authed(aliceToken, '/patient-needs?page=1&pageSize=2')
    ).json();
    const pageTwo = await (
      await authed(aliceToken, '/patient-needs?page=2&pageSize=2')
    ).json();
    const pageThree = await (
      await authed(aliceToken, '/patient-needs?page=3&pageSize=2')
    ).json();

    assert.equal(pageOne.data.length, 2);
    assert.equal(pageTwo.data.length, 2);
    assert.equal(pageThree.data.length, 1);
    assert.deepEqual(pageTwo.meta, {
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });

    const ids = [...pageOne.data, ...pageTwo.data, ...pageThree.data].map(
      (record) => record.id,
    );
    assert.equal(new Set(ids).size, 5, 'pages must not overlap');

    const createdAts = pageOne.data.map((record) => record.createdAt);
    assert.deepEqual(
      [...createdAts].sort().reverse(),
      createdAts,
      'history must be ordered newest first',
    );
  });

  it('returns an empty envelope for a history with no needs', async () => {
    const carolToken = await registerAndLogin('carol@example.com');
    const response = await authed(carolToken, '/patient-needs');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it('rejects invalid pagination values at the API boundary', async () => {
    for (const query of [
      'page=0',
      'page=-1',
      'page=abc',
      'pageSize=0',
      'pageSize=-2',
      'pageSize=1.5',
      'unknown=1',
    ]) {
      const response = await authed(aliceToken, `/patient-needs?${query}`);
      assert.equal(response.status, 400, query);
      const body = await response.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR', query);
    }
    assert.equal(store.patientNeeds.length >= 6, true);
  });
});

describe('GET /patient-needs/:id', () => {
  it('returns an owned need with the canonical envelope', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();
    const response = await authed(
      aliceToken,
      `/patient-needs/${created.data.id}`,
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['data']);
    assert.deepEqual(body.data, created.data);
  });

  it('never discloses another individual’s need (404, not 403)', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();
    const response = await authed(
      bobToken,
      `/patient-needs/${created.data.id}`,
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('rejects malformed identifiers with 400 and unknown ids with 404', async () => {
    const malformed = await authed(aliceToken, '/patient-needs/not-a-uuid');
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, 'VALIDATION_ERROR');

    const missing = await authed(aliceToken, `/patient-needs/${randomUUID()}`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  });
});

describe('POST /patient-needs/:id/cancel', () => {
  it('cancels an owned pending need and persists the transition', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();

    const response = await post(
      `/patient-needs/${created.data.id}/cancel`,
      aliceToken,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'CANCELLED');
    assert.equal(body.data.id, created.data.id);

    const persisted = store.patientNeeds.find(
      (row) => row.id === created.data.id,
    );
    assert.equal(persisted.status, 'CANCELLED');

    const reloaded = await (
      await authed(aliceToken, `/patient-needs/${created.data.id}`)
    ).json();
    assert.equal(reloaded.data.status, 'CANCELLED');
  });

  it('rejects repeated cancellation with 409', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();
    await post(`/patient-needs/${created.data.id}/cancel`, aliceToken);

    const repeated = await post(
      `/patient-needs/${created.data.id}/cancel`,
      aliceToken,
    );
    assert.equal(repeated.status, 409);
    assert.equal((await repeated.json()).error.code, 'CONFLICT');
  });

  it('rejects cancellation once hospital review decided (no D2 write into D3 states)', async () => {
    for (const status of ['VERIFIED', 'REJECTED']) {
      const created = await (
        await post('/patient-needs', aliceToken, validCreatePayload())
      ).json();
      const row = store.patientNeeds.find(
        (need) => need.id === created.data.id,
      );
      row.status = status; // simulate a D3 hospital decision

      const response = await post(
        `/patient-needs/${created.data.id}/cancel`,
        aliceToken,
      );
      assert.equal(response.status, 409, status);
      assert.equal((await response.json()).error.code, 'CONFLICT', status);
      assert.equal(row.status, status, `status must stay ${status}`);
    }
  });

  it('enforces ownership for cancellation', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();

    const foreign = await post(
      `/patient-needs/${created.data.id}/cancel`,
      bobToken,
    );
    assert.equal(foreign.status, 404);

    const malformed = await post(
      '/patient-needs/not-a-uuid/cancel',
      aliceToken,
    );
    assert.equal(malformed.status, 400);

    const missing = await post(
      `/patient-needs/${randomUUID()}/cancel`,
      aliceToken,
    );
    assert.equal(missing.status, 404);

    assert.equal(
      store.patientNeeds.find((row) => row.id === created.data.id).status,
      'PENDING_HOSPITAL_REVIEW',
    );
  });

  it('resolves concurrent cancellation attempts with exactly one success', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();

    const [first, second] = await Promise.all([
      post(`/patient-needs/${created.data.id}/cancel`, aliceToken),
      post(`/patient-needs/${created.data.id}/cancel`, aliceToken),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    assert.equal(
      store.patientNeeds.filter(
        (row) => row.id === created.data.id && row.status === 'CANCELLED',
      ).length,
      1,
    );
  });
});

describe('D2 domain boundary', () => {
  it('never writes BloodRequest, ResponderAssignment, or D4 response models', () => {
    assert.equal(store.bloodRequests.length, 0);
    assert.equal(store.responderAssignments.length, 0);
    assert.equal(store.donorResponses.length, 0);
    assert.equal(store.organizationResponses.length, 0);
  });

  it('exposes no individual route to verify, reject, or promote a need', async () => {
    const created = await (
      await post('/patient-needs', aliceToken, validCreatePayload())
    ).json();

    for (const path of [
      '/blood-requests',
      `/hospital/patient-needs/${created.data.id}/verify`,
      `/hospital/patient-needs/${created.data.id}/reject`,
    ]) {
      const response = await post(path, aliceToken, {});
      // 403 (role-denied D3 route) or 404 (no such individual route),
      // never a successful D3 mutation from D2 authorization.
      assert.ok(
        [403, 404].includes(response.status),
        `${path} returned ${response.status}`,
      );
    }
    assert.equal(
      store.patientNeeds.find((row) => row.id === created.data.id).status,
      'PENDING_HOSPITAL_REVIEW',
    );
    assert.equal(store.bloodRequests.length, 0);
  });
});

function validCreatePayload() {
  return {
    hospitalId: cityHospitalId,
    bloodGroup: 'O_NEGATIVE',
    component: 'RED_BLOOD_CELLS',
    units: 2,
    urgency: 'URGENT',
    requiredBy: new Date(Date.now() + 86_400_000).toISOString(),
    additionalNotes: 'Post-surgery transfusion support',
  };
}

function omit(object, key) {
  const clone = { ...object };
  delete clone[key];
  return clone;
}

async function registerAndLogin(email, overrides = {}) {
  const password = 'a-safe-test-password';
  const registerResponse = await post('/auth/register', null, {
    email,
    password,
  });
  assert.equal(registerResponse.status, 201);
  const { user } = await registerResponse.json().then((body) => body.data);
  const row = store.users.find((candidate) => candidate.id === user.id);
  Object.assign(row, overrides);

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

function MemoryD2Store() {
  this.users = [];
  this.refreshTokens = [];
  this.organizations = [];
  this.patientNeeds = [];
  this.bloodRequests = [];
  this.responderAssignments = [];
  this.donorResponses = [];
  this.organizationResponses = [];

  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

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
      let rows = this.patientNeeds.filter((need) => matches(need, where));
      for (const rule of [...orderBy].reverse()) {
        const [field, direction] = Object.entries(rule)[0];
        rows = [...rows].sort((a, b) => {
          const left = a[field];
          const right = b[field];
          const comparison = left < right ? -1 : left > right ? 1 : 0;
          return direction === 'desc' ? -comparison : comparison;
        });
      }
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

  this.organization = {
    findUnique: async ({ where }) => {
      const organization = this.organizations.find(
        (candidate) => candidate.id === where.id,
      );
      return organization ? { ...organization } : null;
    },
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

  this.organizationMembership = {
    findFirst: async () => null,
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
      organization: this.organization,
      user: this.user,
    });
  };

  this.verifyConnection = async () => {};
}
