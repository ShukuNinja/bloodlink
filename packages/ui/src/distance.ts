/** Formats an API distance measured in metres for user-facing display. */
export function formatDistanceMeters(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return 'Distance unavailable';
  }
  if (distanceMeters < 1_000) return '<1 km';

  const kilometres = distanceMeters / 1_000;
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(kilometres)} km`;
}
