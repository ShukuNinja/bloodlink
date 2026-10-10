/* global require, process, fetch */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D3
 * PURPOSE: Real database integration coverage for hospital PatientNeed
 * review and the official BloodRequest lifecycle. Boots the compiled Nest
 * application against an actual PostgreSQL wire-protocol server (the
 * PGlite-based @prisma/dev test server that ships with the pinned prisma
 * CLI) and drives it through the real Prisma client with the PrismaPg
 * adapter — no repository mocking.
 * ENDPOINT/METHOD: POST /hospital/patient-needs/:id/verify|reject,
 * GET /hospital/patient-needs, POST /blood-requests/:id/cancel and
 * fulfillment actions, asserted against table contents.
 * AUTHORIZATION: Hospital staff principals (JWTs signed with the test
 * access secret) with seeded ACTIVE OrganizationMembership rows; individual
 * principal for PatientNeed creation.
 * STATE CHANGES: Writes to the disposable in-process database only.
 * NON-RESPONSIBILITIES: PostGIS execution — the test server cannot install
 * the postgis extension; D3 issues no spatial queries, so this suite is
 * fully executable without it. Every test self-skips with a reason if the
 * database server cannot start.
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
  'postgresql://postgres:postgres@127.0.0.1:54332/postgres?schema=public';

const DATABASE_PORT = 54332;

const SCHEMA_SQL = `
  CREATE TYPE "UserRole" AS ENUM ('INDIVIDUAL', 'ADMIN');
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'BLOOD_CENTRE');
  CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  CREATE TYPE "OrganizationMembershipRole" AS ENUM (
    'HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTRE_ADMIN', 'BLOOD_CENTRE_STAFF'
  );
  CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
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
  CREATE TYPE "DonorAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
  CREATE TYPE "DonorNotificationPreference" AS ENUM ('ALL', 'URGENT_ONLY', 'CRITICAL_ONLY', 'NONE');
  CREATE TYPE "DonorCoordinationStatus" AS ENUM ('ACTIVE', 'PAUSED');
  CREATE TYPE "CoordinationResponseStatus" AS ENUM ('NOTIFIED', 'ACCEPTED', 'WITHDRAWN', 'EXPIRED');

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

  CREATE TABLE "OrganizationMembership" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "role" "OrganizationMembershipRole" NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMembership_userId_organizationId_key" UNIQUE ("userId", "organizationId")
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

  CREATE TABLE "DonorProfile" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "bloodGroup" "PatientNeedBloodGroup",
    "availabilityStatus" "DonorAvailabilityStatus",
    "notificationPreference" "DonorNotificationPreference",
    "lastConfirmedDonationAt" TIMESTAMPTZ(6),
    "eligibleFrom" TIMESTAMPTZ(6),
    "coordinationStatus" "DonorCoordinationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "DonorResponse" (
    "id" UUID PRIMARY KEY,
    "bloodRequestId" UUID NOT NULL REFERENCES "BloodRequest"("id") ON DELETE CASCADE,
    "donorId" UUID NOT NULL REFERENCES "DonorProfile"("id") ON DELETE RESTRICT,
    "status" "CoordinationResponseStatus" NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonorResponse_bloodRequestId_donorId_key" UNIQUE ("bloodRequestId", "donorId")
  );

  CREATE TABLE "OrganizationResponse" (
    "id" UUID PRIMARY KEY,
    "bloodRequestId" UUID NOT NULL REFERENCES "BloodRequest"("id") ON DELETE CASCADE,
    "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
    "status" "CoordinationResponseStatus" NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationResponse_bloodRequestId_organizationId_key" UNIQUE ("bloodRequestId", "organizationId")
  );

  CREATE TABLE "ResponderAssignment" (
    "id" UUID PRIMARY KEY,
    "bloodRequestId" UUID NOT NULL REFERENCES "BloodRequest"("id") ON DELETE CASCADE,
    "donorResponseId" UUID REFERENCES "DonorResponse"("id") ON DELETE RESTRICT,
    "organizationResponseId" UUID REFERENCES "OrganizationResponse"("id") ON DELETE RESTRICT,
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
let ivy;
let hanna;
let nora;
let cityHospitalId;
let northHospitalId;

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

    cityHospitalId = randomUUID();
    northHospitalId = randomUUID();
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type", "status") VALUES
        ($1, 'D3 City Hospital', 'HOSPITAL', 'ACTIVE'),
        ($2, 'D3 North Hospital', 'HOSPITAL', 'ACTIVE')`,
      [cityHospitalId, northHospitalId],
    );

    ivy = await seedUser('d3-ivy@example.com');
    hanna = await seedUser('d3-hanna@example.com');
    nora = await seedUser('d3-nora@example.com');
    await seedMembership(hanna.id, cityHospitalId, 'HOSPITAL_ADMIN');
    await seedMembership(nora.id, northHospitalId, 'HOSPITAL_ADMIN');

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

describe('D3 hospital review persistence (real database)', () => {
  it('verification creates exactly one BloodRequest row with mapped fields', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, cityHospitalId);

    const response = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hanna.token,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.patientNeed.status, 'VERIFIED');

    const rows = (
      await pool.query(
        `SELECT * FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hospitalId, cityHospitalId);
    assert.equal(rows[0].status, 'OPEN');
    assert.equal(rows[0].bloodGroup, 'O_POSITIVE');
    assert.equal(rows[0].component, 'WHOLE_BLOOD');
    assert.equal(rows[0].unitsRequired, 2);

    const needRow = (
      await pool.query(`SELECT "status" FROM "PatientNeed" WHERE "id" = $1`, [
        need.id,
      ])
    ).rows[0];
    assert.equal(needRow.status, 'VERIFIED');
  });

  it('duplicate verification stays a conflict and never inserts a second row', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, cityHospitalId);
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, hanna.token))
        .status,
      200,
    );

    const repeat = await post(
      `/hospital/patient-needs/${need.id}/verify`,
      hanna.token,
    );
    assert.equal(repeat.status, 409);

    const count = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows[0].c;
    assert.equal(count, 1);
  });

  it('enforces the one-BloodRequest-per-PatientNeed rule at the database level', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, cityHospitalId);
    await post(`/hospital/patient-needs/${need.id}/verify`, hanna.token);
    const existing = (
      await pool.query(
        `SELECT * FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows[0];

    await assert.rejects(
      pool.query(
        `INSERT INTO "BloodRequest"
           ("id", "hospitalId", "patientNeedId", "bloodGroup", "component",
            "unitsRequired", "urgency", "requiredBy")
         VALUES ($1, $2, $3, 'O_POSITIVE', 'WHOLE_BLOOD', 2, 'URGENT', now())`,
        [randomUUID(), cityHospitalId, need.id],
      ),
      /unique|duplicate/i,
    );

    const count = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows[0].c;
    assert.equal(count, 1);
    assert.ok(existing.id, 'original request row preserved');
  });

  it('denies review by a non-member hospital without state changes', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, cityHospitalId);

    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, nora.token))
        .status,
      404,
    );
    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/reject`, nora.token))
        .status,
      404,
    );

    const needRow = (
      await pool.query(`SELECT "status" FROM "PatientNeed" WHERE "id" = $1`, [
        need.id,
      ])
    ).rows[0];
    assert.equal(needRow.status, 'PENDING_HOSPITAL_REVIEW');
    const requestCount = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows[0].c;
    assert.equal(
      requestCount,
      0,
      'no BloodRequest may be created by non-members',
    );
  });

  it('rejects a pending need and then refuses verification', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, northHospitalId);

    const reject = await post(
      `/hospital/patient-needs/${need.id}/reject`,
      nora.token,
    );
    assert.equal(reject.status, 200);
    assert.equal((await reject.json()).data.status, 'REJECTED');

    assert.equal(
      (await post(`/hospital/patient-needs/${need.id}/verify`, nora.token))
        .status,
      409,
    );
    const requestCount = (
      await pool.query(
        `SELECT COUNT(*)::int AS c FROM "BloodRequest" WHERE "patientNeedId" = $1`,
        [need.id],
      )
    ).rows[0].c;
    assert.equal(requestCount, 0, 'rejected needs never produce BloodRequests');
  });

  it('cancels requests only before fulfillment and gates the lifecycle', async (t) => {
    if (!app) return t.skip(skipReason);
    const need = await createNeed(ivy.token, cityHospitalId);
    const requestId = (
      await (
        await post(`/hospital/patient-needs/${need.id}/verify`, hanna.token)
      ).json()
    ).data.bloodRequest.id;

    // Fulfillment cannot start without a selected responder.
    assert.equal(
      (
        await post(
          `/blood-requests/${requestId}/fulfillment/start`,
          hanna.token,
        )
      ).status,
      409,
    );

    const cancel = await post(
      `/blood-requests/${requestId}/cancel`,
      hanna.token,
    );
    assert.equal(cancel.status, 200);
    assert.equal((await cancel.json()).data.status, 'CANCELLED');

    assert.equal(
      (await post(`/blood-requests/${requestId}/cancel`, hanna.token)).status,
      409,
    );
    const row = (
      await pool.query(`SELECT "status" FROM "BloodRequest" WHERE "id" = $1`, [
        requestId,
      ])
    ).rows[0];
    assert.equal(row.status, 'CANCELLED');
  });

  it('writes no D3-foreign state: D4 response and assignment tables stay empty', async (t) => {
    if (!app) return t.skip(skipReason);
    for (const table of [
      'DonorResponse',
      'OrganizationResponse',
      'ResponderAssignment',
    ]) {
      const count = (
        await pool.query(`SELECT COUNT(*)::int AS c FROM "${table}"`)
      ).rows[0].c;
      assert.equal(count, 0, `${table} must remain empty after the D3 journey`);
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function seedMembership(userId, organizationId, role) {
  await pool.query(
    `INSERT INTO "OrganizationMembership"
       ("id", "userId", "organizationId", "role", "status")
     VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [randomUUID(), userId, organizationId, role],
  );
}

async function createNeed(token, hospitalId) {
  const response = await post('/patient-needs', token, {
    hospitalId,
    bloodGroup: 'O_POSITIVE',
    component: 'WHOLE_BLOOD',
    units: 2,
    urgency: 'URGENT',
    requiredBy: new Date(Date.now() + 86_400_000).toISOString(),
    additionalNotes: 'D3 database suite fixture',
  });
  assert.equal(response.status, 201);
  return (await response.json()).data;
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
