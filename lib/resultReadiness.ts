export type ResultExperienceReadiness = {
  mapRuntime: "ready" | "degraded";
  mapStyle: "ready" | "degraded";
};

export const resultPreparationTimeoutMs = 3_000;

function settlePreparation(prepare: () => Promise<void>, timeoutMs: number): Promise<"ready" | "degraded"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: "ready" | "degraded") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish("degraded"), timeoutMs);
    Promise.resolve()
      .then(prepare)
      .then(() => finish("ready"), () => finish("degraded"));
  });
}

export function createResultReadinessCoordinator(
  prepareMapRuntime: () => Promise<void>,
  prepareMapStyle: () => Promise<void>,
  timeoutMs = resultPreparationTimeoutMs
) {
  let pending: Promise<ResultExperienceReadiness> | null = null;

  return {
    prepare(): Promise<ResultExperienceReadiness> {
      pending ??= Promise.all([
        settlePreparation(prepareMapRuntime, timeoutMs),
        settlePreparation(prepareMapStyle, timeoutMs)
      ]).then(([mapRuntime, mapStyle]) => ({ mapRuntime, mapStyle }));
      return pending;
    }
  };
}
