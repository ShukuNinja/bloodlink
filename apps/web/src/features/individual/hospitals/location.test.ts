import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BrowserLocationError,
  parseCoordinates,
  parseRadiusKilometres,
  requestBrowserCoordinates,
} from './location.ts';

test('coordinate parsing accepts geographic boundary values', () => {
  assert.deepEqual(parseCoordinates('-90', '-180'), {
    ok: true,
    value: { latitude: -90, longitude: -180 },
  });
  assert.deepEqual(parseCoordinates('90', '180'), {
    ok: true,
    value: { latitude: 90, longitude: 180 },
  });
});

test('coordinate parsing rejects blanks, non-numbers, and out-of-range values', () => {
  assert.equal(parseCoordinates('', '10').ok, false);
  assert.equal(parseCoordinates('NaN', '10').ok, false);
  assert.equal(parseCoordinates('90.01', '10').ok, false);
  assert.equal(parseCoordinates('10', '-180.01').ok, false);
});

test('radius parsing converts kilometres to API metres and leaves the default unset', () => {
  assert.deepEqual(parseRadiusKilometres(''), { ok: true, value: undefined });
  assert.deepEqual(parseRadiusKilometres('25'), {
    ok: true,
    value: 25_000,
  });
  assert.equal(parseRadiusKilometres('0').ok, false);
  assert.equal(parseRadiusKilometres('Infinity').ok, false);
});

test('browser geolocation requests fresh coordinates with bounded accuracy and timeout', async () => {
  let receivedOptions: PositionOptions | undefined;
  const geolocation = {
    getCurrentPosition(
      success: PositionCallback,
      _error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) {
      receivedOptions = options;
      success({
        coords: {
          latitude: 12.5,
          longitude: 44.25,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: 1,
        toJSON: () => ({}),
      });
    },
  } as Pick<Geolocation, 'getCurrentPosition'>;

  assert.deepEqual(await requestBrowserCoordinates(geolocation), {
    latitude: 12.5,
    longitude: 44.25,
  });
  assert.deepEqual(receivedOptions, {
    enableHighAccuracy: false,
    timeout: 10_000,
    maximumAge: 0,
  });
});

test('browser geolocation errors preserve denial, unavailable, and timeout reasons', async () => {
  for (const [code, reason] of [
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const) {
    const geolocation = {
      getCurrentPosition(
        _success: PositionCallback,
        error?: PositionErrorCallback | null,
      ) {
        error?.({
          code,
          message: 'browser location error',
        } as GeolocationPositionError);
      },
    } as Pick<Geolocation, 'getCurrentPosition'>;

    await assert.rejects(requestBrowserCoordinates(geolocation), (caught) => {
      assert.ok(caught instanceof BrowserLocationError);
      assert.equal(caught.reason, reason);
      return true;
    });
  }
});
