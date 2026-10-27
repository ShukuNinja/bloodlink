export type Coordinates = { latitude: number; longitude: number };

export type LocationProvider = {
  hasServicesEnabledAsync(): Promise<boolean>;
  getForegroundPermissionsAsync(): Promise<{ granted: boolean }>;
  requestForegroundPermissionsAsync(): Promise<{ granted: boolean }>;
  getCurrentPositionAsync(options: {
    accuracy: number;
  }): Promise<{ coords: Coordinates }>;
};

export class DeviceLocationError extends Error {
  readonly reason: 'denied' | 'unavailable' | 'unknown';

  constructor(message: string, reason: DeviceLocationError['reason']) {
    super(message);
    this.name = 'DeviceLocationError';
    this.reason = reason;
  }
}

export function parseRadiusKilometres(input: string) {
  if (!input.trim()) return { ok: true as const, value: undefined };
  const kilometres = Number(input);
  if (!Number.isFinite(kilometres) || kilometres <= 0) {
    return {
      ok: false as const,
      message: 'Search radius must be a positive number of kilometres.',
    };
  }
  return { ok: true as const, value: kilometres * 1_000 };
}

export async function requestDeviceCoordinates(
  provider: LocationProvider,
  accuracy: number,
): Promise<Coordinates> {
  try {
    if (!(await provider.hasServicesEnabledAsync())) {
      throw new DeviceLocationError(
        'Location services are turned off. Enable them or enter coordinates manually.',
        'unavailable',
      );
    }

    let permission = await provider.getForegroundPermissionsAsync();
    if (!permission.granted) {
      permission = await provider.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) {
      throw new DeviceLocationError(
        'Location permission was denied. Allow location access or enter coordinates manually.',
        'denied',
      );
    }

    const result = await provider.getCurrentPositionAsync({ accuracy });
    const { latitude, longitude } = result.coords;
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new DeviceLocationError(
        'The device returned an invalid location. Try again or enter coordinates manually.',
        'unknown',
      );
    }
    return { latitude, longitude };
  } catch (error) {
    if (error instanceof DeviceLocationError) throw error;
    throw new DeviceLocationError(
      'Could not determine your location. Check location services or enter coordinates manually.',
      'unknown',
    );
  }
}
