import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSubscriptionActionDisabled } from './subscription-state.ts';

describe('hospital subscription action state', () => {
  const ready = {
    setupRequired: false,
    loading: false,
    loadError: null,
    busyHospitalIds: new Set(['hospital-a']),
  };

  it('locks only the hospital whose mutation is pending', () => {
    assert.equal(isSubscriptionActionDisabled('hospital-a', ready), true);
    assert.equal(isSubscriptionActionDisabled('hospital-b', ready), false);
  });

  it('locks actions while profile setup or subscription state is unresolved', () => {
    assert.equal(
      isSubscriptionActionDisabled('hospital-a', {
        ...ready,
        setupRequired: true,
        busyHospitalIds: new Set(),
      }),
      true,
    );
    assert.equal(
      isSubscriptionActionDisabled('hospital-a', {
        ...ready,
        loading: true,
        busyHospitalIds: new Set(),
      }),
      true,
    );
    assert.equal(
      isSubscriptionActionDisabled('hospital-a', {
        ...ready,
        loadError: 'offline',
        busyHospitalIds: new Set(),
      }),
      true,
    );
  });
});
