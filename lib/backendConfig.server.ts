export type AccountBackendProvider = "disabled" | "supabase" | "firebase";

export type BackendFeatureConfig = {
  provider: AccountBackendProvider;
  accountsEnabled: boolean;
  rankedGamesEnabled: boolean;
  gameSessionSecret: string | null;
  gameSessionPreviousSecret: string | null;
  supabase: {
    url: string | null;
    publishableKey: string | null;
    secretKey: string | null;
  };
  firebase: {
    apiKey: string | null;
    authDomain: string | null;
    projectId: string | null;
    appId: string | null;
    clientEmail: string | null;
    privateKey: string | null;
  };
};

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConfigError";
  }
}

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function provider(value: string | undefined): AccountBackendProvider {
  const normalized = value?.trim().toLowerCase() || "disabled";
  if (normalized === "disabled" || normalized === "supabase" || normalized === "firebase") return normalized;
  throw new BackendConfigError(`Unsupported account backend provider: ${normalized}`);
}

function requireValues(label: string, values: Record<string, string | null>): void {
  const missing = Object.entries(values).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new BackendConfigError(`${label} is missing required configuration: ${missing.join(", ")}`);
}

export function readBackendFeatureConfig(env: Readonly<Record<string, string | undefined>>): BackendFeatureConfig {
  const selectedProvider = provider(env.ACCOUNT_BACKEND_PROVIDER);
  const accountsEnabled = enabled(env.ACCOUNTS_ENABLED);
  const rankedGamesEnabled = enabled(env.RANKED_GAMES_ENABLED);
  const config: BackendFeatureConfig = {
    provider: selectedProvider,
    accountsEnabled,
    rankedGamesEnabled,
    gameSessionSecret: optional(env.GAME_SESSION_SECRET),
    gameSessionPreviousSecret: optional(env.GAME_SESSION_PREVIOUS_SECRET),
    supabase: {
      url: optional(env.NEXT_PUBLIC_SUPABASE_URL),
      publishableKey: optional(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      secretKey: optional(env.SUPABASE_SECRET_KEY)
    },
    firebase: {
      apiKey: optional(env.NEXT_PUBLIC_FIREBASE_API_KEY),
      authDomain: optional(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
      projectId: optional(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      appId: optional(env.NEXT_PUBLIC_FIREBASE_APP_ID),
      clientEmail: optional(env.FIREBASE_CLIENT_EMAIL),
      privateKey: optional(env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n") ?? null
    }
  };

  if ((accountsEnabled || rankedGamesEnabled) && selectedProvider === "disabled") {
    throw new BackendConfigError("Account features cannot be enabled while the backend provider is disabled.");
  }
  if (rankedGamesEnabled && !accountsEnabled) {
    throw new BackendConfigError("Ranked games require accounts to be enabled.");
  }
  if (rankedGamesEnabled && (!config.gameSessionSecret || config.gameSessionSecret.length < 32)) {
    throw new BackendConfigError("Ranked games require GAME_SESSION_SECRET with at least 32 characters.");
  }
  if (config.gameSessionPreviousSecret && config.gameSessionPreviousSecret.length < 32) {
    throw new BackendConfigError("GAME_SESSION_PREVIOUS_SECRET must contain at least 32 characters when set.");
  }
  if (config.gameSessionSecret && config.gameSessionPreviousSecret === config.gameSessionSecret) {
    throw new BackendConfigError("Current and previous game session secrets must differ.");
  }
  if (accountsEnabled && selectedProvider === "supabase") {
    requireValues("Supabase", {
      NEXT_PUBLIC_SUPABASE_URL: config.supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.supabase.publishableKey,
      SUPABASE_SECRET_KEY: config.supabase.secretKey
    });
  }
  if (accountsEnabled && selectedProvider === "firebase") {
    requireValues("Firebase", {
      NEXT_PUBLIC_FIREBASE_API_KEY: config.firebase.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.firebase.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.firebase.projectId,
      NEXT_PUBLIC_FIREBASE_APP_ID: config.firebase.appId,
      FIREBASE_CLIENT_EMAIL: config.firebase.clientEmail,
      FIREBASE_PRIVATE_KEY: config.firebase.privateKey
    });
  }
  return config;
}
