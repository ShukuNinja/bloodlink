/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { NotFoundException } = require('@nestjs/common');
const { ResponsesService } = require('../dist/responses/responses.service');

describe('GET /donor/responses service boundary', () => {
  it('lists only the authenticated Individual account responses in safe shape', async () => {
    const row = {
      id: 'response-1',
      userId: 'owner-1',
      bloodRequestId: 'request-1',
      status: 'ACCEPTED',
      respondedAt: new Date('2026-01-01T00:00:00.000Z'),
      confirmedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      privateField: 'must not be returned',
    };
    let query;
    const service = new ResponsesService({
      donorResponse: {
        findMany: async (input) => {
          query = input;
          return [row];
        },
      },
    });

    const result = await service.listDonorResponses('owner-1');

    assert.deepEqual(query.where, { userId: 'owner-1' });
    assert.deepEqual(result, [
      {
        id: row.id,
        bloodRequestId: row.bloodRequestId,
        status: row.status,
        respondedAt: row.respondedAt.toISOString(),
        confirmedAt: row.confirmedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    ]);
  });

  it('scopes the lookup to the authenticated Individual even without a donor profile', async () => {
    let query;
    const service = new ResponsesService({
      donorResponse: {
        findMany: async (input) => { query = input; return []; },
      },
    });

    const result = await service.listDonorResponses('other-user');
    assert.deepEqual(result, []);
    assert.deepEqual(query.where, { userId: 'other-user' });
  });
});

describe('GET /blood-centre/responses service boundary', () => {
  it('lists only responses for the caller’s active centre memberships', async () => {
    const row = {
      id: 'response-1',
      organizationId: 'centre-1',
      bloodRequestId: 'request-1',
      status: 'ACCEPTED',
      respondedAt: new Date('2026-01-01T00:00:00.000Z'),
      confirmedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    let query;
    const service = new ResponsesService(
      {
        organizationMembership: {
          findMany: async () => [{ organizationId: 'centre-1' }],
        },
        organizationResponse: {
          findMany: async (input) => {
            query = input;
            return [row];
          },
        },
      },
      {},
    );

    const result = await service.listOrganizationResponses('member-1');

    assert.deepEqual(query.where, {
      organizationId: { in: ['centre-1'] },
    });
    assert.deepEqual(result, [
      {
        id: row.id,
        bloodRequestId: row.bloodRequestId,
        organizationId: row.organizationId,
        status: row.status,
        respondedAt: row.respondedAt.toISOString(),
        confirmedAt: row.confirmedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    ]);
  });

  it('does not query responses without an active centre membership', async () => {
    const service = new ResponsesService(
      {
        organizationMembership: { findMany: async () => [] },
        organizationResponse: {
          findMany: async () => {
            throw new Error('must not query');
          },
        },
      },
      {},
    );

    await assert.rejects(
      service.listOrganizationResponses('unrelated-user'),
      (error) => error instanceof NotFoundException,
    );
  });
});
