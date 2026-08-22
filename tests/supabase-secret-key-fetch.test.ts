import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseSecretKeyFetch } from "../lib/supabase/secretKeyFetch.server";

const secretKey = "sb_secret_test-key-without-real-credentials";

function captureFetch() {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      url: input instanceof Request ? input.url : String(input),
      headers: new Headers(init?.headers)
    });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls, fetcher };
}

test("new secret keys use apikey without a malformed bearer token for PostgREST", async () => {
  const capture = captureFetch();
  const serverFetch = createSupabaseSecretKeyFetch(secretKey, capture.fetcher);

  await serverFetch("https://project.supabase.co/rest/v1/accounts?select=account_id", {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` }
  });

  assert.equal(capture.calls[0].headers.get("apikey"), secretKey);
  assert.equal(capture.calls[0].headers.get("authorization"), null);
});

test("Auth requests and real user access tokens keep their authorization header", async () => {
  const capture = captureFetch();
  const serverFetch = createSupabaseSecretKeyFetch(secretKey, capture.fetcher);

  await serverFetch("https://project.supabase.co/auth/v1/admin/users", {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` }
  });
  await serverFetch("https://project.supabase.co/rest/v1/accounts", {
    headers: { apikey: secretKey, authorization: "Bearer authenticated-user-jwt" }
  });

  assert.equal(capture.calls[0].headers.get("authorization"), `Bearer ${secretKey}`);
  assert.equal(capture.calls[1].headers.get("authorization"), "Bearer authenticated-user-jwt");
});
