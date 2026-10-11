export type Coordinates = { latitude: number; longitude: number };

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

export function parseCoordinates(
  latitudeInput: string,
  longitudeInput: string,
): ParseResult<Coordinates> {
  if (!latitudeInput.trim() || !longitudeInput.trim()) {
    return { ok: false, message: 'Enter both latitude and longitude.' };
  }
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, message: 'Coordinates must be valid numbers.' };
  }
  if (latitude < -90 || latitude > 90) {
    return { ok: false, message: 'Latitude must be between -90 and 90.' };
  }
  if (longitude < -180 || longitude > 180) {
    return { ok: false, message: 'Longitude must be between -180 and 180.' };
  }
  return { ok: true, value: { latitude, longitude } };
}

export function parseRadiusKilometres(
  input: string,
): ParseResult<number | undefined> {
  if (!input.trim()) return { ok: true, value: undefined };
  const kilometres = Number(input);
  if (!Number.isFinite(kilometres) || kilometres <= 0) {
    return {
      ok: false,
      message: 'Search radius must be a positive number of kilometres.',
    };
  }
  return { ok: true, value: kilometres * 1000 };
}

export class BrowserLocationError extends Error {
  readonly reason: 'denied' | 'unavailable' | 'timeout' | 'unknown';

  constructor(
    message: string,
    reason: 'denied' | 'unavailable' | 'timeout' | 'unknown',
  ) {
    super(message);
    this.name = 'BrowserLocationError';
    this.reason = reason;
  }
}

export function requestBrowserCoordinates(
  geolocation: Pick<Geolocation, 'getCurrentPosition'>,
): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const valid = parseCoordinates(
          String(coordinates.latitude),
          String(coordinates.longitude),
        );
        if (valid.ok) resolve(valid.value);
        else {
          reject(
            new BrowserLocationError(
              'The browser returned invalid coordinates. Enter them manually or retry.',
              'unknown',
            ),
          );
        }
      },
      (error) => {
        const reason =
          error.code === 1
            ? 'denied'
            : error.code === 2
              ? 'unavailable'
              : error.code === 3
                ? 'timeout'
                : 'unknown';
        const message =
          reason === 'denied'
            ? 'Location permission was denied. Enter coordinates manually or allow location and retry.'
            : reason === 'unavailable'
              ? 'Your location is unavailable. Enter coordinates manually or retry.'
              : reason === 'timeout'
                ? 'Location lookup timed out. Retry or enter coordinates manually.'
                : 'Could not determine your location. Enter coordinates manually or retry.';
        reject(new BrowserLocationError(message, reason));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 },
    );
  });
}
