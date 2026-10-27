import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DeviceLocationError,
  parseRadiusKilometres,
  requestDeviceCoordinates,
  type LocationProvider,
} from './location.ts';

test('radius input is shown in kilometres and sent to the API in metres', () => {
  assert.deepEqual(parseRadiusKilometres(''), { ok: true, value: undefined });
  assert.deepEqual(parseRadiusKilometres('1.25'), {
    ok: true,
    value: 1_250,
  });
  assert.equal(parseRadiusKilometres('0').ok, false);
});

test('device location asks only for foreground access and returns valid coordinates', async () => {
  let requested = false;
  const provider: LocationProvider = {
    hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ granted: false }),
    requestForegroundPermissionsAsync: async () => {
      requested = true;
      return { granted: true };
    },
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 12.5, longitude: 44.25 },
    }),
  };
  assert.deepEqual(await requestDeviceCoordinates(provider, 3), {
    latitude: 12.5,
    longitude: 44.25,
  });
  assert.equal(requested, true);
});

test('device location reports denied, unavailable, and invalid states explicitly', async () => {
  const provider: LocationProvider = {
    hasServicesEnabledAsync: async () => false,
    getForegroundPermissionsAsync: async () => ({ granted: false }),
    requestForegroundPermissionsAsync: async () => ({ granted: false }),
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 91, longitude: 0 },
    }),
  };
  await assert.rejects(requestDeviceCoordinates(provider, 3), (error) => {
    assert.ok(error instanceof DeviceLocationError);
    assert.equal(error.reason, 'unavailable');
    return true;
  });

  const permissionDenied: LocationProvider = {
    ...provider,
    hasServicesEnabledAsync: async () => true,
  };
  await assert.rejects(
    requestDeviceCoordinates(permissionDenied, 3),
    (error) =>
      error instanceof DeviceLocationError && error.reason === 'denied',
  );
});
