import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSupabaseAuthCookie,
  supabaseAuthCookieName
} from "../lib/supabase/authCookie.server";

const supabaseUrl = "https://abcdefghijklm.supabase.co";

test("derives the SSR auth-cookie name from the Supabase project reference", () => {
  assert.equal(supabaseAuthCookieName(supabaseUrl), "sb-abcdefghijklm-auth-token");
  assert.equal(supabaseAuthCookieName("not a url"), null);
});

test("guest ranked requests do not look authenticated", () => {
  const request = new Request("https://punktlandung.app/api/v1/ranked-games/game", {
    headers: { cookie: "pl_ranked_guest=signed-guest; theme=dark" }
  });
  assert.equal(hasSupabaseAuthCookie(request, supabaseUrl), false);
});

test("whole and chunked Supabase SSR session cookies are detected", () => {
  const whole = new Request("https://punktlandung.app", {
    headers: { cookie: "sb-abcdefghijklm-auth-token=session" }
  });
  const chunked = new Request("https://punktlandung.app", {
    headers: { cookie: "sb-abcdefghijklm-auth-token.0=chunk; sb-abcdefghijklm-auth-token.1=chunk" }
  });
  assert.equal(hasSupabaseAuthCookie(whole, supabaseUrl), true);
  assert.equal(hasSupabaseAuthCookie(chunked, supabaseUrl), true);
});
