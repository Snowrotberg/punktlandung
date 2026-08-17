import assert from "node:assert/strict";
import test from "node:test";
import { BackendConfigError, readBackendFeatureConfig } from "../lib/backendConfig.server";

test("backend features default to safely disabled", () => {
  const config = readBackendFeatureConfig({});
  assert.equal(config.provider, "disabled");
  assert.equal(config.accountsEnabled, false);
  assert.equal(config.rankedGamesEnabled, false);
});

test("features cannot be enabled without a selected provider", () => {
  assert.throws(
    () => readBackendFeatureConfig({ ACCOUNTS_ENABLED: "true" }),
    BackendConfigError
  );
});

test("ranked games require accounts and a strong server secret", () => {
  assert.throws(() => readBackendFeatureConfig({
    ACCOUNT_BACKEND_PROVIDER: "supabase",
    RANKED_GAMES_ENABLED: "true"
  }), BackendConfigError);
  assert.throws(() => readBackendFeatureConfig({
    ACCOUNT_BACKEND_PROVIDER: "supabase",
    ACCOUNTS_ENABLED: "true",
    RANKED_GAMES_ENABLED: "true",
    GAME_SESSION_SECRET: "short"
  }), BackendConfigError);
});

test("Supabase configuration is validated only when selected", () => {
  const config = readBackendFeatureConfig({
    ACCOUNT_BACKEND_PROVIDER: "supabase",
    ACCOUNTS_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
    SUPABASE_SECRET_KEY: "server-only"
  });
  assert.equal(config.provider, "supabase");
  assert.equal(config.supabase.secretKey, "server-only");
});

test("Firebase private key newlines are restored on the server", () => {
  const config = readBackendFeatureConfig({
    ACCOUNT_BACKEND_PROVIDER: "firebase",
    ACCOUNTS_ENABLED: "true",
    NEXT_PUBLIC_FIREBASE_API_KEY: "api",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "project.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "project",
    NEXT_PUBLIC_FIREBASE_APP_ID: "app",
    FIREBASE_CLIENT_EMAIL: "firebase-admin@example.test",
    FIREBASE_PRIVATE_KEY: "line-1\\nline-2"
  });
  assert.equal(config.provider, "firebase");
  assert.equal(config.firebase.privateKey, "line-1\nline-2");
});

test("session secret rotation rejects weak or identical previous secrets", () => {
  assert.throws(() => readBackendFeatureConfig({
    GAME_SESSION_SECRET: "current-session-secret-with-32-characters",
    GAME_SESSION_PREVIOUS_SECRET: "weak"
  }), BackendConfigError);
  assert.throws(() => readBackendFeatureConfig({
    GAME_SESSION_SECRET: "same-session-secret-with-32-characters",
    GAME_SESSION_PREVIOUS_SECRET: "same-session-secret-with-32-characters"
  }), BackendConfigError);
});
