export type OptionalAccountNavigationState = {
  enabled: boolean;
  authenticated: boolean;
  displayName: string | null;
};

export async function loadOptionalAccountNavigation<T>(options: {
  enabled: boolean;
  loadContext: () => Promise<T | null>;
  loadDisplayName: (context: T) => Promise<string | null>;
  onError?: (error: unknown) => void;
}): Promise<OptionalAccountNavigationState> {
  if (!options.enabled) return { enabled: false, authenticated: false, displayName: null };

  try {
    const context = await options.loadContext();
    const displayName = context ? await options.loadDisplayName(context) : null;
    return { enabled: true, authenticated: Boolean(context), displayName };
  } catch (error) {
    options.onError?.(error);
    return { enabled: true, authenticated: false, displayName: null };
  }
}
