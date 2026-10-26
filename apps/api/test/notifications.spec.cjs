/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  NotificationsService,
} = require('../dist/notifications/notifications.service');

describe('in-app request alerts', () => {
  it('shows open requests to every Individual and omits their responded requests', async () => {
    const service = new NotificationsService({
      organizationSubscription: { findMany: async () => [] },
      organizationMembership: { findMany: async () => [] },
      bloodRequest: {
        findMany: async () => [request('open-1'), request('open-2')],
      },
      $queryRaw: async (strings) =>
        strings.join('').includes('information_schema')
          ? [{ present: true }]
          : [{ bloodRequestId: 'open-2' }],
    });

    const alerts = await service.listForUser('individual-1', 'INDIVIDUAL');
    assert.deepEqual(
      alerts.map((alert) => alert.bloodRequestId),
      ['open-1'],
    );
    assert.equal(alerts[0].hospitalName, 'City Hospital');
    assert.equal(Object.hasOwn(alerts[0], 'userId'), false);
  });

  it('shows subscribed hospital requests to active organization members', async () => {
    let requestQuery;
    const service = new NotificationsService({
      organizationSubscription: {
        findMany: async () => [{ organizationId: 'hospital-1' }],
      },
      organizationMembership: {
        findMany: async () => [{ organizationId: 'centre-1' }],
      },
      bloodRequest: {
        findMany: async (query) => {
          requestQuery = query;
          return [request('open-1')];
        },
      },
    });

    const alerts = await service.listForUser('blood-centre-user', 'INDIVIDUAL');
    assert.deepEqual(requestQuery.where.hospitalId, { in: ['hospital-1'] });
    assert.deepEqual(
      alerts.map((alert) => alert.bloodRequestId),
      ['open-1'],
    );
    assert.equal(alerts[0].source, 'HOSPITAL_SUBSCRIPTION');
  });

  it('does not query requests for organization members without subscriptions', async () => {
    let queriedRequests = false;
    const service = new NotificationsService({
      organizationSubscription: { findMany: async () => [] },
      organizationMembership: {
        findMany: async () => [{ organizationId: 'hospital-1' }],
      },
      bloodRequest: {
        findMany: async () => {
          queriedRequests = true;
          return [];
        },
      },
    });

    assert.deepEqual(
      await service.listForUser('hospital-user', 'INDIVIDUAL'),
      [],
    );
    assert.equal(queriedRequests, false);
  });
});

function request(id) {
  return {
    id,
    hospitalId: 'hospital-1',
    bloodGroup: 'O_POSITIVE',
    component: 'RED_BLOOD_CELLS',
    unitsRequired: 2,
    urgency: 'URGENT',
    requiredBy: new Date('2026-10-12T08:00:00.000Z'),
    status: 'OPEN',
    hospital: { name: 'City Hospital' },
  };
}
