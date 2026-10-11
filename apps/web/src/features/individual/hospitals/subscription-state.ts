export type SubscriptionActionState = {
  setupRequired: boolean;
  loading: boolean;
  loadError: string | null;
  busyHospitalIds: ReadonlySet<string>;
};

export function isSubscriptionActionDisabled(
  hospitalId: string,
  state: SubscriptionActionState,
): boolean {
  return (
    state.setupRequired ||
    state.loading ||
    state.loadError !== null ||
    state.busyHospitalIds.has(hospitalId)
  );
}
