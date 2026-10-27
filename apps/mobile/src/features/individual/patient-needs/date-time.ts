/** Serializes a native picker Date, preserving its selected local-time instant. */
export function serializeRequiredBy(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

export function isRequiredByInFuture(value: Date, now = Date.now()): boolean {
  return Number.isFinite(value.getTime()) && value.getTime() > now;
}

export function hasRequiredDateTime(
  dateSelected: boolean,
  timeSelected: boolean,
): boolean {
  return dateSelected && timeSelected;
}
