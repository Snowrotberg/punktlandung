import assert from "node:assert/strict";
import test from "node:test";
import { AccountProfileHttpApi } from "../lib/accountProfileHttp.server";
import { InMemoryAccountProfileRepository } from "../lib/accountProfileRepository";
import { AccountProfileService } from "../lib/accountProfileService";

const origin = "https://punktlandung.example";

function harness() {
  let now = 1_000;
  const profiles = new AccountProfileService(new InMemoryAccountProfileRepository());
  const api = new AccountProfileHttpApi(
    profiles,
    { read: async (request) => request.headers.get("x-account") ? ({
      accountId: request.headers.get("x-account") as string,
      sessionId: "session-0001", provider: "google", authenticatedAt: 1_000, expiresAt: 100_000
    }) : null },
    { check: async () => ({ allowed: true }) },
    { expectedOrigin: origin, now: () => now }
  );
  return { api, profiles, setNow: (value: number) => { now = value; } };
}

function write(method: "POST" | "PATCH", body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`${origin}/api/v1/me/profile`, {
    method,
    headers: {
      "content-type": "application/json", origin, "sec-fetch-site": "same-origin",
      "x-account": "account-0001", ...headers
    },
    body: JSON.stringify(body)
  });
}

test("profile HTTP creates and updates only the authenticated account", async () => {
  const { api, setNow } = harness();
  const created = await api.create(write("POST", { handle: "AtlasOne", displayName: "Atlas" }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).data.accountId, "account-0001");
  setNow(2_000);
  const updated = await api.update(write("PATCH", { displayName: "Atlas Neu", visibility: "private" }));
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.visibility, "private");
  const own = await api.me(new Request(`${origin}/api/v1/me/profile`, { headers: { "x-account": "account-0001" } }));
  assert.equal((await own.json()).data.displayName, "Atlas Neu");
});

test("public profile HTTP strips internal IDs and hides private profiles", async () => {
  const { api, profiles } = harness();
  await profiles.create("account-0001", { handle: "AtlasOne", displayName: "Atlas", now: 1_000 });
  const response = await api.publicProfile(new Request(`${origin}/api/v1/profiles/AtlasOne`), "AtlasOne");
  const raw = await response.text();
  assert.equal(response.status, 200);
  assert.equal(raw.includes("account-0001"), false);
  assert.equal(raw.includes("normalizedHandle"), false);
  await profiles.update("account-0001", { visibility: "private", now: 2_000 });
  assert.equal((await api.publicProfile(new Request(`${origin}/api/v1/profiles/AtlasOne`), "AtlasOne")).status, 404);
});

test("profile writes require auth, exact origin and a strict payload", async () => {
  const { api } = harness();
  const anonymous = write("POST", { handle: "AtlasOne", displayName: "Atlas" }, { "x-account": "" });
  assert.equal((await api.create(anonymous)).status, 401);
  const foreign = write("POST", { handle: "AtlasOne", displayName: "Atlas" }, { origin: "https://attacker.example" });
  assert.equal((await api.create(foreign)).status, 403);
  const unknown = write("POST", { handle: "AtlasOne", displayName: "Atlas", status: "admin" });
  assert.equal((await api.create(unknown)).status, 400);
  assert.equal((await api.update(write("PATCH", {}))).status, 400);
});
