type PlacementLoadFailure = { ok: false; code: string };

export type PlacementLoadResult<T> = { ok: true; placement: T } | PlacementLoadFailure;

const defaultDelaysMs = [0, 250, 750, 1_500] as const;

export async function loadPlacementAfterVerification<T>(
  load: () => Promise<PlacementLoadResult<T>>,
  options: {
    delaysMs?: readonly number[];
    pause?: (delayMs: number) => Promise<void>;
    cancelled?: () => boolean;
  } = {}
): Promise<PlacementLoadResult<T>> {
  const delaysMs = options.delaysMs ?? defaultDelaysMs;
  const pause = options.pause ?? ((delayMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delayMs)));
  let result: PlacementLoadResult<T> = { ok: false, code: "not_ranked" };

  for (const delayMs of delaysMs) {
    if (options.cancelled?.()) return result;
    if (delayMs > 0) await pause(delayMs);
    if (options.cancelled?.()) return result;
    result = await load();
    if (result.ok || result.code !== "not_ranked") return result;
  }

  return result;
}
