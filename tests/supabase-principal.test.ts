import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { principalFromSupabaseUser } from "../lib/supabase/principal";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "4b09d42a-b7eb-461c-984f-032eb7ddd9f4",
    app_metadata: { provider: "google" },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-08-15T08:00:00.000Z",
    updated_at: "2026-08-15T08:00:00.000Z",
    identities: [{
      id: "provider-row",
      identity_id: "080fc7dc-44ba-4a8f-9c53-ebac7887f6f0",
      user_id: "4b09d42a-b7eb-461c-984f-032eb7ddd9f4",
      identity_data: {},
      provider: "google",
      created_at: "2026-08-15T08:00:00.000Z",
      updated_at: "2026-08-15T08:00:00.000Z"
    }],
    ...overrides
  } as User;
}

test("Supabase principal uses the stable provider identity", () => {
  const now = Date.parse("2026-08-15T08:05:00.000Z");
  const principal = principalFromSupabaseUser(user(), now);
  assert.equal(principal.loginProvider, "google");
  assert.equal(principal.providerSubject, "080fc7dc-44ba-4a8f-9c53-ebac7887f6f0");
});

test("Supabase principal clamps a future auth timestamp to app time", () => {
  const now = Date.parse("2026-08-15T08:05:00.000Z");
  const principal = principalFromSupabaseUser(user({ last_sign_in_at: "2026-08-15T10:05:00.000Z" }), now);
  assert.equal(principal.verifiedAt, now);
});
