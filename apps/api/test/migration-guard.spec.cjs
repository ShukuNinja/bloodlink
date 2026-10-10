/* global require, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D2 (verification-only; the migration itself is lead-owned and is
 * never modified here).
 * PURPOSE: Executable evidence for the acceptance gate concerning the
 * hospital-coordinate migration. Migration
 * 20261009110000_d4_responses_and_spatial_locations begins with a plpgsql
 * guard that halts the migration when pre-existing HOSPITAL organizations
 * lack legacy coordinates. This suite extracts that exact DO block from the
 * real migration file and executes it on a real PostgreSQL engine (the
 * PGlite-based @prisma/dev server) against representative pre-existing
 * organization rows:
 *   - HOSPITAL rows with missing legacy coordinates -> migration halts with
 *     the documented error (nothing is backfilled, nothing is dropped);
 *   - HOSPITAL rows with coordinates (plus non-hospital rows without
 *     coordinates) -> guard passes.
 * SCOPE LIMITATION: The remainder of that migration and the full chain
 * require the PostGIS extension, which cannot be installed in this sandbox
 * (egress-restricted). Those parts remain UNVERIFIED here and must be
 * executed against an isolated PostgreSQL/PostGIS database. No coordinates
 * are invented and no constraint is weakened.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { after, before, describe, it } = require('node:test');

const DATABASE_PORT = 54335;
const MIGRATION_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'migrations',
  '20261009110000_d4_responses_and_spatial_locations',
  'migration.sql',
);

const LEGACY_ORGANIZATION_DDL = `
  CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'BLOOD_CENTRE');
  CREATE TABLE "Organization" (
    "id" UUID PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    CONSTRAINT "Organization_coordinates_pair_check"
      CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    CONSTRAINT "Organization_hospital_coordinates_check"
      CHECK ("type" <> 'HOSPITAL' OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))
  )`;

let server;
let pool;
let guardBlock = null;
let skipReason = null;

before(async () => {
  try {
    const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    const match = /DO \$\$([\s\S]*?)\$\$;/.exec(migrationSql);
    assert.ok(match, 'migration must contain the coordinate guard DO block');
    guardBlock = match[0];

    const devPath = path.join(
      path.dirname(require.resolve('prisma/package.json')),
      '..',
      '@prisma',
      'dev',
      'dist',
      'index.cjs',
    );
    const { startPrismaDevServer } = require(devPath);
    server = await startPrismaDevServer({
      databasePort: DATABASE_PORT,
      persistenceMode: 'stateless',
    });

    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: `postgresql://postgres:postgres@127.0.0.1:${DATABASE_PORT}/postgres`,
    });
  } catch (error) {
    skipReason = `disposable database unavailable: ${error.message}`;
  }
});

after(async () => {
  await pool?.end();
  await server?.close();
});

describe('hospital-coordinate migration guard (executed on a real PostgreSQL engine)', () => {
  it('halts when a pre-existing HOSPITAL row lacks legacy coordinates', async (t) => {
    if (!pool) return t.skip(skipReason);
    await resetOrganizations();
    // The legacy schema itself allows inserting hospitals without
    // coordinates only if the old check constraint is absent; simulate the
    // audited production drift by inserting directly without the hospital
    // constraint, as the audit scenario describes.
    await pool.query(
      `ALTER TABLE "Organization" DROP CONSTRAINT "Organization_hospital_coordinates_check"`,
    );
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type", "latitude", "longitude")
       VALUES ($1, 'Legacy Hospital Without Coordinates', 'HOSPITAL', NULL, NULL)`,
      [randomUUID()],
    );

    await assert.rejects(
      pool.query(guardBlock),
      (error) => {
        assert.match(String(error.message), /missing coordinates/);
        assert.match(String(error.message), /1 hospital organization/);
        return true;
      },
      'guard must raise before any coordinate backfill or column drop',
    );
  });

  it('passes when every pre-existing HOSPITAL row has coordinates', async (t) => {
    if (!pool) return t.skip(skipReason);
    await resetOrganizations();
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type", "latitude", "longitude")
       VALUES ($1, 'Legacy Hospital A', 'HOSPITAL', 6.524400, 3.379200),
              ($2, 'Legacy Hospital B', 'HOSPITAL', -1.234567, 45.678901)`,
      [randomUUID(), randomUUID()],
    );
    // Non-hospital organizations are allowed to lack coordinates.
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type")
       VALUES ($1, 'Legacy Blood Centre', 'BLOOD_CENTRE')`,
      [randomUUID()],
    );

    await pool.query(guardBlock); // must not throw
  });

  it('counts only HOSPITAL rows (non-hospital NULL coordinates do not halt)', async (t) => {
    if (!pool) return t.skip(skipReason);
    await resetOrganizations();
    await pool.query(
      `ALTER TABLE "Organization" DROP CONSTRAINT "Organization_hospital_coordinates_check"`,
    );
    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "type", "latitude", "longitude")
       VALUES ($1, 'Legacy Hospital A', 'HOSPITAL', 6.524400, 3.379200),
              ($2, 'Legacy Hospital Broken', 'HOSPITAL', NULL, NULL),
              ($3, 'Legacy Hospital Broken Too', 'HOSPITAL', NULL, NULL),
              ($4, 'Legacy Centre', 'BLOOD_CENTRE', NULL, NULL)`,
      [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    );

    await assert.rejects(pool.query(guardBlock), (error) => {
      assert.match(String(error.message), /2 hospital organization/);
      return true;
    });
  });

  it('migration files still contain the authoritative spatial design (unchanged)', async (t) => {
    if (!pool) return t.skip(skipReason);
    const extensionSql = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'prisma',
        'migrations',
        '20261008000000_enable_postgis',
        'migration.sql',
      ),
      'utf8',
    );
    assert.match(extensionSql, /CREATE EXTENSION IF NOT EXISTS postgis/);

    const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    assert.match(migrationSql, /ADD COLUMN "location" geography\(Point,4326\)/);
    assert.match(
      migrationSql,
      /ST_SetSRID\(ST_MakePoint\("longitude"::double precision, "latitude"::double precision\), 4326\)/,
    );
    assert.match(migrationSql, /Organization_hospital_location_check/);
    assert.match(migrationSql, /DROP COLUMN "latitude"/);
    assert.match(migrationSql, /USING GIST \("location"\)/);
  });
});

async function resetOrganizations() {
  await pool.query(`DROP TABLE IF EXISTS "Organization"`);
  await pool.query(`DROP TYPE IF EXISTS "OrganizationType"`);
  await pool.query(LEGACY_ORGANIZATION_DDL);
}
