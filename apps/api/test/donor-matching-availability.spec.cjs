/* global require */
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { MatchingService } = require('../dist/matching/matching.service');

describe('Individual request discovery', () => {
  it('does not require donor profile, blood group, location, or preferences', async () => {
    const calls = [];
    const service = new MatchingService({
      $queryRaw: async () => {
        calls.push(true);
        return calls.length === 1 ? [{ total: 1 }] : [{
          id: 'request-1', bloodGroup: 'O_POSITIVE', component: 'WHOLE_BLOOD',
          unitsRequired: 1, urgency: 'URGENT', requiredBy: new Date('2026-10-12T08:00:00Z'),
          status: 'OPEN', hospitalName: 'City Hospital', distanceMeters: null,
        }];
      },
    });

    const result = await service.listDonorRequests('individual-user', { page: 1, pageSize: 20 });
    assert.equal(result.meta.total, 1);
    assert.equal(result.data[0].id, 'request-1');
    assert.equal(calls.length, 2);
  });
});
