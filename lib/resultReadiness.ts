export type ResultExperienceReadiness = {
  mapRuntime: "ready" | "degraded";
  mapStyle: "ready" | "degraded";
};

export function createResultReadinessCoordinator(
  prepareMapRuntime: () => Promise<void>,
  prepareMapStyle: () => Promise<void>
) {
  let pending: Promise<ResultExperienceReadiness> | null = null;

  return {
    prepare(): Promise<ResultExperienceReadiness> {
      pending ??= Promise.all([
        prepareMapRuntime().then(() => "ready" as const, () => "degraded" as const),
        prepareMapStyle().then(() => "ready" as const, () => "degraded" as const)
      ]).then(([mapRuntime, mapStyle]) => ({ mapRuntime, mapStyle }));
      return pending;
    }
  };
}
