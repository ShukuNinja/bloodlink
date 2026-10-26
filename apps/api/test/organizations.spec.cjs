/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * OWNER: D1
 * PURPOSE: Verify the shared hospital and blood-bank directory search policy.
 * INPUT: Name, type, sort direction, and transient geographic criteria.
 * OUTPUT: Complete active-organization summaries, without coordinates.
 * AUTHORIZATION: The controller enforces authenticated access.
 * DEPENDENCIES: OrganizationsService, Prisma SQL, active Organization rows.
 * STATE CHANGES: None; repository calls are captured in memory.
 * NON-RESPONSIBILITIES: PostGIS execution, subscription writes, or conversations.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  OrganizationsService,
} = require('../dist/organizations/organizations.service');

test('returns the full active organization directory in ascending name order', async () => {
  const rows = [
    { id: '1', name: 'Central Hospital', type: 'HOSPITAL' },
    { id: '2', name: 'North Blood Bank', type: 'BLOOD_CENTRE' },
  ];
  let findManyInput;
  const service = new OrganizationsService({
    organization: {
      findMany: async (input) => {
        findManyInput = input;
        return rows;
      },
    },
  });

  assert.deepEqual(await service.search({}), rows);
  assert.deepEqual(findManyInput.where, { status: 'ACTIVE' });
  assert.deepEqual(findManyInput.orderBy, [{ name: 'asc' }, { id: 'asc' }]);
  assert.equal(Object.hasOwn(findManyInput, 'take'), false);
});

test('supports name and organization-type filters with descending sorting', async () => {
  let findManyInput;
  const service = new OrganizationsService({
    organization: {
      findMany: async (input) => {
        findManyInput = input;
        return [];
      },
    },
  });

  await service.search({
    query: 'city',
    type: 'HOSPITAL',
    sortOrder: 'DESC',
  });

  assert.deepEqual(findManyInput.where, {
    status: 'ACTIVE',
    type: 'HOSPITAL',
    name: { contains: 'city', mode: 'insensitive' },
  });
  assert.deepEqual(findManyInput.orderBy, [{ name: 'desc' }, { id: 'asc' }]);
  assert.equal(Object.hasOwn(findManyInput, 'take'), false);
});

test('uses a parameterized PostGIS radius filter without returning coordinates', async () => {
  let rawQuery;
  const service = new OrganizationsService({
    $queryRaw: async (query) => {
      rawQuery = query;
      return [];
    },
  });

  await service.search({
    latitude: 13.0827,
    longitude: 80.2707,
    radiusMeters: 5000,
    type: 'BLOOD_CENTRE',
    query: 'Rainbow',
    sortOrder: 'DESC',
  });

  assert.match(rawQuery.sql, /ST_DWithin/);
  assert.match(rawQuery.sql, /ILIKE/);
  assert.match(rawQuery.sql, /ORDER BY lower\("name"\) DESC/);
  assert.match(rawQuery.sql, /SELECT "id", "name", "type"/);
  assert.ok(rawQuery.values.includes(80.2707));
  assert.ok(rawQuery.values.includes(13.0827));
  assert.ok(rawQuery.values.includes(5000));
  assert.ok(rawQuery.values.includes('BLOOD_CENTRE'));
  assert.ok(rawQuery.values.includes('%Rainbow%'));
});
