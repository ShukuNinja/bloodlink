/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D2
 * PURPOSE: Real database integration coverage for the PatientNeed API.
 * Boots the compiled Nest application against an actual PostgreSQL
 * wire-protocol server (the PGlite-based @prisma/dev test server that ships
 * with the pinned prisma CLI) and drives it through the real Prisma client
 * with the PrismaPg adapter — no repository mocking.
 * ENDPOINT/METHOD: POST /patient-needs, GET /patient-needs,
 * GET /patient-needs/:id, POST /patient-needs/:id/cancel.
 * AUTHORIZATION: Authenticated INDIVIDUAL principals (JWTs signed with the
 * test access secret; user rows live in the real database).
 * STATE CHANGES: Writes to the disposable in-process database only.
 * NON-RESPONSIBILITIES: PostGIS execution — the test server cannot install
 * the postgis extension, so hospital spatial search remains covered by the
 * structural suite in hospitals.spec.cjs (documented limitation). Every test
 * self-skips with a reason if the database server cannot start.
 */

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaService } = require('../dist/database/prisma.service');
const { configureApi } = require('../dist/http/configure-api');

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-with-more-than-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-also-over-32-characters';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@127.0.0.1:54331/postgres?schema=public';

const DATABASE_PORT = 54331;

const SCHEMA_SQL = `
  CREATE TYPE "UserRole" AS ENUM ('INDIVIDUAL', 'ADMIN');
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'BLOOD_CENTRE');
  CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  CREATE TYPE "PatientNeedBloodGroup" AS ENUM (
    'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
    'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
  );
  CREATE TYPE "PatientNeedComponent" AS ENUM (
    'WHOLE_BLOOD', 'RED_BLOOD_CELLS', 'PLATELETS', 'PLASMA'
  );
  CREATE TYPE "PatientNeedUrgency" AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');
  CREATE TYPE "PatientNeedStatus" AS ENUM (
    'PENDING_HOSPITAL_REVIEW', 'VERIFIED', 'REJECTED', 'CANCELLED'
  );
  CREATE TYPE "BloodRequestStatus" AS ENUM (
    'OPEN', 'RESPONSES_RECEIVED', 'COVERED', 'COORDINATING', 'BACKUP_REQUIRED',
    'FULFILLMENT_PENDING', 'FULFILLMENT_CONFIRMED', 'FULFILLED', 'CANCELLED'
  );
  CREATE TYPE "ResponderAssignmentState" AS ENUM ('SELECTED', 'STANDBY', 'RELEASED');

  CREATE TABLE "User" (
    "id" UUID PRIMARY KEY,
    "email" VARCHAR(320) NOT NULL UNIQUE,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "Organization" (
    "id" UUID PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "PatientNeed" (
    "id" UUID PRIMARY KEY,
    "submittedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "hospitalId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
    "bloodGroup" "PatientNeedBloodGroup" NOT NULL,
    "component" "PatientNeedComponent" NOT NULL,
    "units" INTEGER NOT NULL,
    "urgency" "PatientNeedUrgency" NOT NULL,
    "requiredBy" TIMESTAMPTZ(6) NOT NULL,
    "additionalNotes" TEXT NOT NULL,
    "status" "PatientNeedStatus" NOT NULL DEFAULT 'PENDING_HOSPITAL_REVIEW',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX "PatientNeed_submittedByUserId_createdAt_idx"
    ON "PatientNeed"("submittedByUserId", "createdAt");

  CREATE TABLE "BloodRequest" (
    "id" UUID PRIMARY KEY,
    "hospitalId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
    "patientNeedId" UUID NOT NULL UNIQUE REFERENCES "PatientNeed"("id") ON DELETE RESTRICT,
    "bloodGroup" "PatientNeedBloodGroup" NOT NULL,
    "component" "PatientNeedComponent" NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "urgency" "PatientNeedUrgency" NOT NULL,
    "requiredBy" TIMESTAMPTZ(6) NOT NULL,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "ResponderAssignment" (
    "id" UUID PRIMARY KEY,
    "bloodRequestId" UUID NOT NULL REFERENCES "BloodRequest"("id") ON DELETE CASCADE,
    "donorResponseId" UUID,
    "organizationResponseId" UUID,
    "state" "ResponderAssignmentState" NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

let app;
let baseUrl;
let server;
let pool;
let prisma;
let jwt;
let skipReason = null;
let alice;
let bob;
let hospitalId;
let bloodCentreId;
let suspendedHospitalId;

before(async () => {
  try {
    jwt = new JwtService({});
    const devModulePath = path.join(
      path.dirname(require.resolve('prisma/package.json')),
      '..',
      '@prisma',
      'dev',
      'dist',
      'index.cjs',
    );
    const { startPrismaDevServer } = require(devModulePath);
    server = await startPrismaDevServer({
      databasePort: DATABASE_PORT,
      persistenceMode: 'stateless',
    });

    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: `postgresql://postgres:postgres@127.0.0.1:${DATABASE_PORT}/postgres`,
    });
    for (const statement of SCHEMA_SQL.split(';')) {
      if (statement.trim()) await pool.query(statement);
    }

    hospitalId = randomUUID();
    bloodCentreId = randomUUID();
    suspendedHospitalId = randomUUID();
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type", "status") VALUES
        ($1, 'Real City Hospital', 'HOSPITAL', 'ACTIVE'),
        ($2, 'Real River Centre', 'BLOOD_CENTRE', 'ACTIVE'),
        ($3, 'Real Closed Hospital', 'HOSPITAL', 'SUSPENDED')`,
      [hospitalId, bloodCentreId, suspendedHospitalId],
    );

    alice = await seedUser('db-alice@example.com');
    bob = await seedUser('db-bob@example.com');

    const {
      PrismaClient,
    } = require('../dist/database/generated/prisma/client');
    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres:postgres@127.0.0.1:${DATABASE_PORT}/postgres`,
      }),
    });
    prisma.verifyConnection = async () => {
      await prisma.$queryRaw`SELECT 1`;
    };

    process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${DATABASE_PORT}/postgres?schema=public`;
    const { AppModule } = require('../dist/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApi(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  } catch (error) {
    skipReason = `disposable database unavailable: ${error.message}`;
  }
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect?.();
  await pool?.end();
  await server?.close();
});

describe('PatientNeed persistence (real database)', () => {
  it('creates a row server-side with authenticated ownership and initial status', async (t) => {
    if (!app) return t.skip(skipReason);
    const requiredBy = new Date(Date.now() + 86_400_000);
    requiredBy.setMilliseconds(0);

    const response = await post('/patient-needs', alice.token, {
      hospitalId,
      bloodGroup: 'B_POSITIVE',
      component: 'PLASMA',
      units: 3,
      urgency: 'ROUTINE',
      requiredBy: requiredBy.toISOString(),
      additionalNotes: 'Scheduled surgery coordination',
    });
    assert.equal(response.status, 201);
    const record = (await response.json()).data;
    assert.equal(record.status, 'PENDING_HOSPITAL_REVIEW');

    const rows = await pool.query(
      `SELECT "submittedByUserId", "hospitalId", "bloodGroup", "component",
              "units", "urgency", "status", "requiredBy", "additionalNotes"
       FROM "PatientNeed" WHERE "id" = $1`,
      [record.id],
    );
    assert.equal(rows.rowCount, 1);
    const row = rows.rows[0];
    assert.equal(row.submittedByUserId, alice.id);
    assert.equal(row.hospitalId, hospitalId);
    assert.equal(row.bloodGroup, 'B_POSITIVE');
    assert.equal(row.component, 'PLASMA');
    assert.equal(row.units, 3);
    assert.equal(row.urgency, 'ROUTINE');
    assert.equal(row.status, 'PENDING_HOSPITAL_REVIEW');
    assert.equal(row.additionalNotes, 'Scheduled surgery coordination');
    assert.equal(
      new Date(row.requiredBy).toISOString(),
      requiredBy.toISOString(),
      'requiredBy must round-trip as an exact timestamp',
    );
  });

  it('rejects unapproved hospitals without inserting', async (t) => {
    if (!app) return t.skip(skipReason);
    const baseline = await countNeeds();

    for (const candidate of [
      randomUUID(),
      bloodCentreId,
      suspendedHospitalId,
    ]) {
      const response = await post('/patient-needs', alice.token, {
        hospitalId: candidate,
        bloodGroup: 'A_POSITIVE',
        component: 'WHOLE_BLOOD',
        units: 1,
        urgency: 'URGENT',
        requiredBy: new Date(Date.now() + 3_600_000).toISOString(),
        additionalNotes: 'Needs a valid hospital',
      });
      // LEAD DECISION D4: well-formed UUID for a missing or ineligible
      // hospital -> 422 with the canonical envelope.
      assert.equal(response.status, 422, candidate);
      assert.equal(
        (await response.json()).error.code,
        'VALIDATION_ERROR',
        candidate,
      );
    }
    assert.equal(await countNeeds(), baseline);
  });

  it('isolates history and reads per owner at the database level', async (t) => {
    if (!app) return t.skip(skipReason);
    for (let index = 0; index < 3; index += 1) {
      await assertCreated(alice.token);
    }
    await assertCreated(bob.token);

    const aliceList = await (
      await authed(alice.token, '/patient-needs?pageSize=50')
    ).json();
    const bobList = await (
      await authed(bob.token, '/patient-needs?pageSize=50')
    ).json();

    const aliceDbCount = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "PatientNeed" WHERE "submittedByUserId" = $1`,
        [alice.id],
      )
    ).rows[0].c;
    assert.equal(aliceList.meta.total, aliceDbCount);
    assert.equal(aliceList.data.length, aliceDbCount);
    assert.equal(bobList.meta.total, 1);
    assert.equal(bobList.data.length, 1);

    const aliceIds = new Set(aliceList.data.map((record) => record.id));
    assert.ok(!aliceIds.has(bobList.data[0].id));

    const foreignRead = await authed(
      bob.token,
      `/patient-needs/${aliceList.data[0].id}`,
    );
    assert.equal(foreignRead.status, 404);
  });

  it('paginates against the database with consistent totals', async (t) => {
    if (!app) return t.skip(skipReason);
    const total = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "PatientNeed" WHERE "submittedByUserId" = $1`,
        [alice.id],
      )
    ).rows[0].c;
    assert.ok(total >= 4, 'suite must have created several needs');

    const body = await (
      await authed(alice.token, '/patient-needs?page=2&pageSize=2')
    ).json();
    assert.deepEqual(body.meta, {
      page: 2,
      pageSize: 2,
      total,
      totalPages: Math.ceil(total / 2),
    });
    assert.equal(body.data.length, Math.max(Math.min(2, total - 2), 0));
  });

  it('persists cancellation and rejects repeat or post-review cancellation', async (t) => {
    if (!app) return t.skip(skipReason);
    const created = await assertCreated(alice.token);

    const cancelled = await post(
      `/patient-needs/${created.id}/cancel`,
      alice.token,
    );
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).data.status, 'CANCELLED');
    const dbStatus = (
      await pool.query(`SELECT "status" FROM "PatientNeed" WHERE "id" = $1`, [
        created.id,
      ])
    ).rows[0].status;
    assert.equal(dbStatus, 'CANCELLED');

    const repeated = await post(
      `/patient-needs/${created.id}/cancel`,
      alice.token,
    );
    assert.equal(repeated.status, 409);

    const verified = await assertCreated(alice.token);
    await pool.query(
      `UPDATE "PatientNeed" SET "status" = 'VERIFIED' WHERE "id" = $1`,
      [verified.id],
    );
    const rejected = await post(
      `/patient-needs/${verified.id}/cancel`,
      alice.token,
    );
    assert.equal(rejected.status, 409);
    assert.equal(
      (
        await pool.query(`SELECT "status" FROM "PatientNeed" WHERE "id" = $1`, [
          verified.id,
        ])
      ).rows[0].status,
      'VERIFIED',
    );
  });

  it('serializes concurrent cancellations: exactly one wins', async (t) => {
    if (!app) return t.skip(skipReason);
    const created = await assertCreated(alice.token);

    const [first, second] = await Promise.all([
      post(`/patient-needs/${created.id}/cancel`, alice.token),
      post(`/patient-needs/${created.id}/cancel`, alice.token),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);

    const rows = await pool.query(
      `SELECT "status", COUNT(*)::int AS c FROM "PatientNeed"
       WHERE "id" = $1 GROUP BY "status"`,
      [created.id],
    );
    assert.equal(rows.rowCount, 1);
    assert.deepEqual(rows.rows[0], { status: 'CANCELLED', c: 1 });
  });

  it('never writes D3/D4-owned models', async (t) => {
    if (!app) return t.skip(skipReason);
    for (const table of ['BloodRequest', 'ResponderAssignment']) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS c FROM "${table}"`,
      );
      assert.equal(result.rows[0].c, 0, table);
    }
  });
});

async function seedUser(email) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO "User" ("id", "email", "passwordHash", "role", "status")
     VALUES ($1, $2, $3, 'INDIVIDUAL', 'ACTIVE')`,
    [id, email, 'unused-in-database-suite'],
  );
  const token = await jwt.signAsync(
    { sub: id },
    { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
  );
  return { id, token };
}

async function countNeeds() {
  return (await pool.query(`SELECT COUNT(*)::int AS c FROM "PatientNeed"`))
    .rows[0].c;
}

async function assertCreated(token) {
  const response = await post('/patient-needs', token, {
    hospitalId,
    bloodGroup: 'O_POSITIVE',
    component: 'RED_BLOOD_CELLS',
    units: 1,
    urgency: 'ROUTINE',
    requiredBy: new Date(Date.now() + 7_200_000).toISOString(),
    additionalNotes: 'Database integration coverage',
  });
  assert.equal(response.status, 201);
  return (await response.json()).data;
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
