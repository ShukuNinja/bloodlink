/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D2
 * PURPOSE: End-to-end behavior for GET /api/v1/hospitals discovery.
 * INPUT: Authenticated HTTP requests against the compiled Nest application.
 * OUTPUT: Verified authorization, canonical search validation, safe
 * HospitalSummary projections, and the PostGIS query structure (spatial
 * filtering, default radius, ranking, name filtering).
 * AUTHORIZATION: Authenticated INDIVIDUAL.
 * DEPENDENCIES: AppModule, PrismaService override with a captured $queryRaw.
 * STATE CHANGES: In-memory only.
 * NON-RESPONSIBILITIES: Executing the query against a real PostGIS database.
 * No PostGIS-capable database is installable in this sandbox; the SQL is
 * asserted structurally and against PostGIS function usage, which is the
 * highest-fidelity verification available here (documented limitation).
 */

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, describe, it, beforeEach } = require('node:test');
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
let individualToken;
let adminToken;

before(async () => {
  const { AppModule } = require('../dist/app.module');
  store = new MemoryHospitalStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(store)
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  configureApi(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();

  individualToken = await registerAndLogin('individual@example.com');
  adminToken = await registerAndLogin('admin@example.com', { role: 'ADMIN' });
});

after(async () => {
  await app?.close();
});

beforeEach(() => {
  store.rawQueries = [];
  store.rawQueryError = null;
  store.hospitalRows = [];
});

describe('authorization', () => {
  it('requires authenticated individual access', async () => {
    const anonymous = await fetch(
      `${baseUrl}/api/v1/hospitals?latitude=1&longitude=2`,
    );
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).error.code, 'UNAUTHORIZED');

    const admin = await fetch(
      `${baseUrl}/api/v1/hospitals?latitude=1&longitude=2`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert.equal(admin.status, 403);
    assert.equal((await admin.json()).error.code, 'FORBIDDEN');
    assert.equal(store.rawQueries.length, 0);
  });
});

describe('search input validation', () => {
  it('rejects invalid transient search input before any database access', async () => {
    const cases = [
      '?longitude=12.3', // missing latitude
      '?latitude=12.3', // missing longitude
      '?latitude=91&longitude=0',
      '?latitude=-90.5&longitude=0',
      '?latitude=0&longitude=181',
      '?latitude=abc&longitude=0',
      '?latitude=0&longitude=0&radiusMeters=-5',
      '?latitude=0&longitude=0&radiusMeters=soon',
      '?latitude=0&longitude=0&query=',
      '?latitude=0&longitude=0&unexpected=1',
    ];

    for (const query of cases) {
      const response = await authed(`/hospitals${query}`);
      assert.equal(response.status, 400, query);
      const body = await response.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR', query);
      assert.ok(Array.isArray(body.error.details.issues), query);
    }
    assert.equal(store.rawQueries.length, 0);
  });
});

describe('discovery results', () => {
  it('returns only the shared HospitalSummary contract', async () => {
    store.hospitalRows = [
      {
        id: randomUUID(),
        name: 'City Hospital',
        latitude: 6.5244,
        longitude: 3.3792,
        distanceMeters: 1200.5,
      },
      {
        id: randomUUID(),
        name: 'North Hospital',
        latitude: 6.6018,
        longitude: 3.3515,
        distanceMeters: 5400.75,
      },
    ];

    const response = await authed(
      '/hospitals?latitude=6.5&longitude=3.4&radiusMeters=8000',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['data']);
    assert.equal(body.data.length, 2);
    for (const summary of body.data) {
      assert.deepEqual(Object.keys(summary).sort(), [
        'id',
        'latitude',
        'longitude',
        'name',
      ]);
    }
    assert.equal(body.data[0].name, 'City Hospital');
    assert.equal(body.data[0].latitude, 6.5244);
    // Internal ranking data and organization internals never leak.
    assert.equal(body.data[0].distanceMeters, undefined);
  });

  it('returns an empty list when nothing is in range', async () => {
    store.hospitalRows = [];
    const response = await authed('/hospitals?latitude=6.5&longitude=3.4');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [] });
  });

  it('maps server errors to the canonical internal error envelope', async () => {
    store.rawQueryError = new Error('postgis password=secret unavailable');
    const response = await authed('/hospitals?latitude=6.5&longitude=3.4');
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});

describe('PostGIS query design', () => {
  it('filters with ST_DWithin on the geography column and ranks by distance', async () => {
    await authed('/hospitals?latitude=6.5&longitude=3.4&radiusMeters=8000');

    assert.equal(store.rawQueries.length, 1);
    const { text, values } = store.rawQueries[0];
    assert.match(text, /ST_DWithin\("location"/);
    assert.match(text, /ST_MakePoint/);
    assert.match(text, /ST_SetSRID/);
    assert.match(text, /::geography/);
    assert.match(text, /ST_Distance\("location"/);
    assert.match(text, /ORDER BY "distanceMeters" ASC, "name" ASC/);
    assert.match(text, /ST_Y\("location"::geometry\)/);
    assert.match(text, /ST_X\("location"::geometry\)/);
    assert.match(text, /"type" = 'HOSPITAL'/);
    assert.match(text, /"status" = 'ACTIVE'/);
    // Coordinates enter as bound parameters, never string-interpolated.
    assert.ok(values.includes(3.4), 'longitude bound as parameter');
    assert.ok(values.includes(6.5), 'latitude bound as parameter');
    assert.ok(values.includes(8000), 'radius bound as parameter');
  });

  it('applies the documented default radius when radiusMeters is omitted', async () => {
    await authed('/hospitals?latitude=6.5&longitude=3.4');

    const { values } = store.rawQueries[0];
    assert.ok(
      values.includes(25_000),
      'default search radius must be used when unspecified',
    );
  });

  it('filters by name with an escaped ILIKE pattern', async () => {
    await authed(
      `/hospitals?latitude=6.5&longitude=3.4&query=${encodeURIComponent('ci%ty_1')}`,
    );

    const { text, values } = store.rawQueries[0];
    assert.match(text, /ILIKE/);
    assert.ok(
      values.includes('%ci\\%ty\\_1%'),
      'wildcards in the user query must be escaped',
    );
  });

  it('never persists the transient caller coordinates', async () => {
    await authed('/hospitals?latitude=6.5&longitude=3.4');
    assert.equal(store.patientNeeds?.length ?? 0, 0);
    assert.equal(store.organizations?.length ?? 0, 0);
    assert.ok(!('searchLocations' in store));
  });
});

async function registerAndLogin(email, overrides = {}) {
  const password = 'a-safe-test-password';
  const registerResponse = await post('/auth/register', {
    email,
    password,
  });
  assert.equal(registerResponse.status, 201);
  const { user } = (await registerResponse.json()).data;
  Object.assign(
    store.users.find((candidate) => candidate.id === user.id),
    overrides,
  );
  const loginResponse = await post('/auth/login', { email, password });
  assert.equal(loginResponse.status, 200);
  return (await loginResponse.json()).data.accessToken;
}

function authed(path) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${individualToken}` },
  });
}

function post(path, body) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function MemoryHospitalStore() {
  this.users = [];
  this.refreshTokens = [];
  this.rawQueries = [];
  this.rawQueryError = null;
  this.hospitalRows = [];

  this.user = {
    findUnique: async ({ where }) =>
      this.users.find(
        (user) => user.id === where.id || user.email === where.email,
      ) ?? null,
    create: async ({ data }) => {
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
      const token = this.refreshTokens.find((item) => item.id === where.id);
      if (!token) return { count: 0 };
      Object.assign(token, data);
      return { count: 1 };
    },
    deleteMany: async () => ({ count: 0 }),
  };

  this.organizationMembership = {
    findFirst: async () => null,
    findMany: async () => [],
  };

  this.$queryRaw = async (query) => {
    this.rawQueries.push({
      text: query?.text ?? query?.sql ?? String(query),
      values: query?.values ?? [],
    });
    if (this.rawQueryError) throw this.rawQueryError;
    return this.hospitalRows.map((row) => ({ ...row }));
  };

  this.$transaction = async (callback) =>
    callback({
      user: this.user,
      organization: this.organization,
      organizationMembership: this.organizationMembership,
      $executeRaw: async (strings) => {
        const sql = strings.join('');
        throw new Error(`Unexpected auth raw SQL: ${sql}`);
      },
    });

  this.verifyConnection = async () => {};
}
