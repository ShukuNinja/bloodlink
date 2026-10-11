/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  BloodRequestsRepository,
} = require('../dist/blood-requests/blood-requests.repository');

describe('hospital responder identity projection', () => {
  it('keeps Individual identity private and shows Blood Centre names', async () => {
    const repository = new BloodRequestsRepository({
      organizationMembership: {
        findMany: async () => [{ organizationId: 'hospital-1' }],
      },
      bloodRequest: {
        findFirst: async () => ({ id: 'request-1', hospitalId: 'hospital-1' }),
      },
      $queryRaw: async (strings) =>
        strings.join('').includes('information_schema')
          ? [{ present: true }]
          : [
              {
                id: 'selected-response',
                status: 'ACCEPTED',
                email: 'donor@example.com',
                selected: true,
              },
              {
                id: 'unselected-response',
                status: 'ACCEPTED',
                email: 'donor@example.com',
                selected: false,
              },
            ],
      organizationResponse: {
        findMany: async () => [
          {
            id: 'centre-response',
            status: 'ACCEPTED',
            organization: { name: 'Harbour Blood Centre' },
          },
        ],
      },
      responderAssignment: {
        findMany: async () => [{ donorResponseId: 'selected-response' }],
      },
    });

    const responses = await repository.listResponseReferences(
      'hospital-user',
      'request-1',
    );
    const selected = responses.find(
      (response) => response.responseId === 'selected-response',
    );
    const unselected = responses.find(
      (response) => response.responseId === 'unselected-response',
    );

    assert.equal(selected.status, 'ACCEPTED');
    assert.equal(Object.hasOwn(unselected, 'responderName'), false);
    assert.equal(Object.hasOwn(selected, 'responderName'), false);
    assert.equal(
      responses.find((response) => response.responseId === 'centre-response')
        .responderName,
      'Harbour Blood Centre',
    );
  });

  it('keeps a withdrawn Individual anonymous even with a stale assignment', async () => {
    const repository = new BloodRequestsRepository({
      organizationMembership: {
        findMany: async () => [{ organizationId: 'hospital-1' }],
      },
      bloodRequest: {
        findFirst: async () => ({ id: 'request-1', hospitalId: 'hospital-1' }),
      },
      $queryRaw: async (strings) =>
        strings.join('').includes('information_schema')
          ? [{ present: true }]
          : [
              {
                id: 'selected-response',
                status: 'WITHDRAWN',
                email: 'donor@example.com',
                selected: true,
              },
            ],
      organizationResponse: { findMany: async () => [] },
      responderAssignment: {
        findMany: async () => [{ donorResponseId: 'selected-response' }],
      },
    });

    const [response] = await repository.listResponseReferences(
      'hospital-user',
      'request-1',
    );

    assert.equal(Object.hasOwn(response, 'responderName'), false);
  });
});
