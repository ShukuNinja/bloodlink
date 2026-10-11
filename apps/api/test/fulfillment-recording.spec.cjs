/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { BloodRequestsRepository } = require('../dist/blood-requests/blood-requests.repository');

describe('hospital fulfillment and D4 donation recording', () => {
  it('records a selected donor in the same transaction as fulfillment confirmation', async () => {
    const state = repositoryState('ACCEPTED', 'DONOR_RESPONSE');
    const repository = new BloodRequestsRepository(state.prisma);
    let recorded;
    let transactionUsed;

    const result = await repository.confirmFulfillment(
      'hospital-user',
      'request-1',
      async (transaction, input) => {
        transactionUsed = transaction === state.prisma;
        recorded = input;
      },
    );

    assert.equal(result.status, 'FULFILLMENT_CONFIRMED');
    assert.equal(state.request.status, 'FULFILLMENT_CONFIRMED');
    assert.equal(transactionUsed, true);
    assert.equal(recorded.donorUserId, 'donor-user-1');
    assert.equal(recorded.bloodRequestId, 'request-1');
    assert.equal(recorded.confirmedByUserId, 'hospital-user');
    assert.ok(recorded.confirmedAt instanceof Date);
  });

  it('does not record a donation if the selected donor has withdrawn', async () => {
    const state = repositoryState('WITHDRAWN', 'DONOR_RESPONSE');
    const repository = new BloodRequestsRepository(state.prisma);
    let recorded = false;

    await assert.rejects(
      repository.confirmFulfillment('hospital-user', 'request-1', async () => {
        recorded = true;
      }),
      (error) => error.status === 409,
    );

    assert.equal(recorded, false);
    assert.equal(state.request.status, 'FULFILLMENT_PENDING');
  });

  it('confirms a selected Blood Centre without creating a donor record', async () => {
    const state = repositoryState('ACCEPTED', 'ORGANIZATION_RESPONSE');
    const repository = new BloodRequestsRepository(state.prisma);
    let recorded = false;

    const result = await repository.confirmFulfillment(
      'hospital-user',
      'request-1',
      async () => {
        recorded = true;
      },
    );

    assert.equal(result.status, 'FULFILLMENT_CONFIRMED');
    assert.equal(recorded, false);
  });
});

function repositoryState(responseStatus, responseType) {
  const request = {
    id: 'request-1',
    hospitalId: 'hospital-1',
    patientNeedId: 'need-1',
    bloodGroup: 'O_POSITIVE',
    component: 'RED_BLOOD_CELLS',
    unitsRequired: 1,
    urgency: 'URGENT',
    requiredBy: new Date('2026-10-12T08:00:00.000Z'),
    status: 'FULFILLMENT_PENDING',
    createdAt: new Date('2026-10-11T08:00:00.000Z'),
    updatedAt: new Date('2026-10-11T08:00:00.000Z'),
  };
  const selected = {
    donorResponseId: responseType === 'DONOR_RESPONSE' ? 'response-1' : null,
    organizationResponseId:
      responseType === 'ORGANIZATION_RESPONSE' ? 'response-1' : null,
  };
  const prisma = {
    organizationMembership: {
      findMany: async () => [{ organizationId: 'hospital-1' }],
    },
    bloodRequest: {
      findFirst: async () => ({ ...request }),
      updateMany: async ({ data }) => {
        request.status = data.status;
        return { count: 1 };
      },
    },
    responderAssignment: { findFirst: async () => selected },
    donorResponse: {
      findUnique: async () => ({
          userId: 'donor-user-1',
        status: responseStatus,
      }),
    },
    organizationResponse: {
      findUnique: async () => ({ status: responseStatus }),
    },
    $transaction: async (callback) => callback(prisma),
  };
  return { prisma, request };
}
