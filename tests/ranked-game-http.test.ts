import assert from "node:assert/strict";
import test from "node:test";
import { RankedGameHttpApi, rankedGuestCookieName } from "../lib/rankedGameHttp.server";
import { RankedGuestSessionCodec } from "../lib/rankedGuestSession.server";
import { InMemoryRankedGameRepository } from "../lib/rankedGameRepository";
import { RankedGameService } from "../lib/rankedGameService";
import type { GeoLocation } from "../types/game";

const origin = "https://punktlandung.example";
const secret = "ranked-http-test-session-secret-32-characters";

function location(): GeoLocation {
  return {
    id: "secret-location",
    title: "Geheimer Testort",
    countryCode: "DE",
    countryName: "Deutschland",
    continent: "Europe",
    lat: 48,
    lng: 9,
    panoramaUrl: "https://images.example/secret.jpg",
    attribution: "Test",
    source: "ugc",
    category: "landmarks"
  };
}

function harness() {
  let timestamp = 1_000;
  let gameCounter = 0;
  const service = new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async () => [location()] },
    { gameId: () => `game-${String(++gameCounter).padStart(4, "0")}`, roundId: () => "round-0001" },
    { roundCount: 1, roundDurationMs: 60_000 }
  );
  const api = new RankedGameHttpApi(
    service,
    new RankedGuestSessionCodec([secret], 72 * 60 * 60 * 1000),
    { read: async (request) => request.headers.get("x-test-account") ? ({
      accountId: request.headers.get("x-test-account") as string,
      sessionId: "session-0001",
      provider: "google",
      authenticatedAt: 1_000,
      expiresAt: 100_000
    }) : null },
    { check: async () => ({ allowed: true }) },
    { read: async () => ({ bytes: new Uint8Array([1, 2, 3]).buffer, contentType: "image/jpeg" }) },
    { expectedOrigin: origin, now: () => timestamp }
  );
  return { api, setNow: (value: number) => { timestamp = value; } };
}

function post(path: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "sec-fetch-site": "same-origin", ...headers },
    body: JSON.stringify(body)
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Secure/);
  return setCookie.split(";", 1)[0];
}

test("start issues an HttpOnly guest capability and never leaks the active answer", async () => {
  const { api } = harness();
  const response = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001" }));
  assert.equal(response.status, 201);
  assert.match(cookieFrom(response), new RegExp(`^${rankedGuestCookieName}=`));
  assert.equal(response.headers.get("cache-control"), "no-store");
  const raw = await response.text();
  assert.equal(raw.includes("Geheimer Testort"), false);
  assert.equal(raw.includes("secret-location"), false);
  assert.equal(raw.includes("images.example"), false);
});

test("active recovery restores the guest game without a browser-side game id", async () => {
  const { api } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-recovery" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  const recoveredResponse = await api.recoverLatest(new Request(`${origin}/api/v1/ranked-games/active`, {
    headers: { cookie }
  }));
  assert.equal(recoveredResponse.status, 200);
  const recovered = (await recoveredResponse.json()).data;
  assert.equal(recovered.gameId, started.gameId);
  assert.equal(recovered.status, "active");
});

test("local recovery can explicitly rescue an active game while production cannot", async () => {
  const repository = new InMemoryRankedGameRepository();
  const service = new RankedGameService(
    repository,
    { drawLocations: async () => [location()] },
    { gameId: () => "game-rescue", roundId: () => "round-rescue" },
    { roundCount: 1 }
  );
  await service.start({ createRequestId: "request-rescue", guestIdHash: "old-guest", now: 1_000 });
  const codec = new RankedGuestSessionCodec([secret]);
  const localApi = new RankedGameHttpApi(
    service,
    codec,
    { read: async () => null },
    { check: async () => ({ allowed: true }) },
    { read: async () => ({ bytes: new Uint8Array([1]).buffer, contentType: "image/jpeg" }) },
    { expectedOrigin: "http://localhost:3000", allowLocalDevelopmentOrigin: true, secureCookies: false, now: () => 2_000 }
  );
  const session = codec.issue(2_000);
  const cookie = `${rankedGuestCookieName}=${session.token}`;
  const response = await localApi.recoverLatest(new Request("http://localhost:3000/api/v1/ranked-games/active?resume=game-rescue", {
    headers: { cookie }
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.gameId, "game-rescue");

  const forwardedLocalResponse = await localApi.recoverLatest(new Request("http://dev-proxy.internal/api/v1/ranked-games/active?resume=game-rescue", {
    headers: { cookie }
  }));
  assert.equal(forwardedLocalResponse.status, 200);
  assert.equal((await forwardedLocalResponse.json()).data.gameId, "game-rescue");

  const productionApi = new RankedGameHttpApi(
    service,
    codec,
    { read: async () => null },
    { check: async () => ({ allowed: true }) },
    { read: async () => ({ bytes: new Uint8Array([1]).buffer, contentType: "image/jpeg" }) },
    { expectedOrigin: origin, allowLocalDevelopmentOrigin: false, now: () => 2_000 }
  );
  const denied = await productionApi.recoverLatest(new Request(`${origin}/api/v1/ranked-games/active?resume=game-rescue`, {
    headers: { cookie }
  }));
  assert.equal(denied.status, 404);
});

test("write requests require the configured same origin", async () => {
  const { api } = harness();
  const request = post("/api/v1/ranked-games", { requestId: "request-0001" }, { origin: "https://attacker.example" });
  const response = await api.start(request);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "origin_forbidden");
});

test("local development accepts a same-host LAN origin without allowing a foreign host", async () => {
  const service = new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async () => [location()] },
    { gameId: () => "game-0001", roundId: () => "round-0001" },
    { roundCount: 1 }
  );
  const api = new RankedGameHttpApi(
    service,
    new RankedGuestSessionCodec([secret]),
    { read: async () => null },
    { check: async () => ({ allowed: true }) },
    { read: async () => ({ bytes: new Uint8Array([1]).buffer, contentType: "image/jpeg" }) },
    { expectedOrigin: "http://localhost:3000", allowLocalDevelopmentOrigin: true, secureCookies: false, now: () => 1_000 }
  );
  const request = new Request("http://localhost:3000/api/v1/ranked-games", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "192.168.178.33:3000",
      origin: "http://192.168.178.33:3000",
      "sec-fetch-site": "same-origin"
    },
    body: JSON.stringify({ requestId: "request-0001" })
  });
  assert.equal((await api.start(request)).status, 201);

  const foreignRequest = new Request("http://localhost:3000/api/v1/ranked-games", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "192.168.178.33:3000",
      origin: "http://attacker.example",
      "sec-fetch-site": "cross-site"
    },
    body: JSON.stringify({ requestId: "request-0002" })
  });
  assert.equal((await api.start(foreignRequest)).status, 403);
});

test("opaque prompt endpoint proxies bytes without revealing the private source URL", async () => {
  const { api } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  const prompt = await api.prompt(new Request(`${origin}${started.activeRound.assetUrl}`, {
    headers: { cookie }
  }), started.gameId, started.activeRound.roundId);
  assert.equal(prompt.status, 200);
  assert.equal(prompt.headers.get("content-type"), "image/jpeg");
  assert.equal(prompt.headers.get("cache-control"), "private, max-age=3600, immutable");
  assert.deepEqual(Array.from(new Uint8Array(await prompt.arrayBuffer())), [1, 2, 3]);
  assert.equal(JSON.stringify([...prompt.headers]).includes("images.example"), false);
});

test("HTTP flow starts, submits and claims a guest game without trusting client time", async () => {
  const { api, setNow } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001", rulesetId: "daily-five" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  assert.equal(started.status, "active");

  setNow(5_000);
  const capturedResponse = await api.captureGuess(post(
    `/api/v1/ranked-games/${started.gameId}/capture`,
    { roundId: started.activeRound.roundId, guessId: "guess-0001", lat: 48, lng: 9, countryCode: "de" },
    { cookie }
  ), started.gameId);
  assert.equal(capturedResponse.status, 200);
  setNow(65_000);
  const submittedResponse = await api.submitGuess(post(
    `/api/v1/ranked-games/${started.gameId}/guesses`,
    { roundId: started.activeRound.roundId, guessId: "guess-0001" },
    { cookie }
  ), started.gameId);
  assert.equal(submittedResponse.status, 200);
  const completed = (await submittedResponse.json()).data;
  assert.equal(completed.status, "completed");
  assert.equal(completed.totalResponseTimeMs, 4_000);
  assert.equal(completed.claimed, false);

  const anonymousClaim = await api.claim(post(`/api/v1/ranked-games/${started.gameId}/claim`, {}, { cookie }), started.gameId);
  assert.equal(anonymousClaim.status, 401);

  const claim = await api.claim(post(
    `/api/v1/ranked-games/${started.gameId}/claim`,
    {},
    { cookie, "x-test-account": "account-0001" }
  ), started.gameId);
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).data.claimed, true);
});

test("ranked capture rejects late receipt, forged client time and uncaptured submit tokens", async () => {
  const { api, setNow } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-capture-abuse" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  setNow(61_001);

  const late = await api.captureGuess(post(
    `/api/v1/ranked-games/${started.gameId}/capture`,
    { roundId: started.activeRound.roundId, guessId: "guess-late", lat: 48, lng: 9 },
    { cookie }
  ), started.gameId);
  assert.equal(late.status, 409);
  assert.equal((await late.json()).error.code, "round_expired");

  const forgedTime = await api.captureGuess(post(
    `/api/v1/ranked-games/${started.gameId}/capture`,
    { roundId: started.activeRound.roundId, guessId: "guess-forged", lat: 48, lng: 9, capturedAt: 5_000 },
    { cookie }
  ), started.gameId);
  assert.equal(forgedTime.status, 400);
  assert.equal((await forgedTime.json()).error.code, "invalid_request");

  const forgedSubmit = await api.submitGuess(post(
    `/api/v1/ranked-games/${started.gameId}/guess`,
    { roundId: started.activeRound.roundId, guessId: "guess-forged" },
    { cookie }
  ), started.gameId);
  assert.equal(forgedSubmit.status, 409);
  assert.equal((await forgedSubmit.json()).error.code, "capture_required");
});

test("authenticated ranked flow auto-claims the completed game for the account", async () => {
  const { api, setNow } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", {
    requestId: "request-0002",
    rulesetId: "daily-five",
    rounds: 1,
    timeLimitSec: 15,
    difficulty: "hard",
    noZoom: true
  }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  assert.equal(started.timeLimitSec, 15);
  assert.equal(started.difficulty, "hard");
  assert.equal(started.noZoom, true);
  setNow(5_000);
  const capturedResponse = await api.captureGuess(post(
    `/api/v1/ranked-games/${started.gameId}/capture`,
    { roundId: started.activeRound.roundId, guessId: "guess-0002", lat: 48, lng: 9 },
    { cookie, "x-test-account": "account-0002" }
  ), started.gameId);
  assert.equal(capturedResponse.status, 200);
  const completedResponse = await api.submitGuess(post(
    `/api/v1/ranked-games/${started.gameId}/guesses`,
    { roundId: started.activeRound.roundId, guessId: "guess-0002" },
    { cookie, "x-test-account": "account-0002" }
  ), started.gameId);
  assert.equal(completedResponse.status, 200);
  const completed = (await completedResponse.json()).data;
  assert.equal(completed.claimed, true);
  assert.equal(completed.integrityStatus, "verified");
  assert.equal(completed.timeLimitSec, 15);
  assert.equal(completed.difficulty, "hard");
  assert.equal(completed.noZoom, true);
});

test("expired round is closed by server time and scores zero", async () => {
  const { api, setNow } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  setNow(61_001);
  const expired = await api.expireRound(post(
    `/api/v1/ranked-games/${started.gameId}/expire`,
    {},
    { cookie }
  ), started.gameId);
  assert.equal(expired.status, 200);
  const completed = (await expired.json()).data;
  assert.equal(completed.status, "completed");
  assert.equal(completed.score, 0);
  assert.equal(completed.totalResponseTimeMs, 60_000);
});

test("ranked guess endpoint rejects a client-supplied interaction timestamp", async () => {
  const { api, setNow } = harness();
  const startedResponse = await api.start(post("/api/v1/ranked-games", { requestId: "request-client-time" }));
  const cookie = cookieFrom(startedResponse);
  const started = (await startedResponse.json()).data;
  setNow(61_001);
  const response = await api.submitGuess(post(
    `/api/v1/ranked-games/${started.gameId}/guesses`,
    {
      roundId: started.activeRound.roundId,
      guessId: "guess-client-time",
      lat: 48,
      lng: 9,
      submittedAt: 60_999
    },
    { cookie }
  ), started.gameId);
  assert.equal(response.status, 400);
});

test("transport rejects unknown fields, oversized bodies and missing guest authority", async () => {
  const { api } = harness();
  const unknown = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001", score: 99_999 }));
  assert.equal(unknown.status, 400);

  const oversized = post("/api/v1/ranked-games", { requestId: "request-0001" }, { "content-length": "9000" });
  assert.equal((await api.start(oversized)).status, 413);

  const missingGuest = await api.get(new Request(`${origin}/api/v1/ranked-games/game-0001`), "game-0001");
  assert.equal(missingGuest.status, 401);
});

test("another signed guest cannot enumerate or claim a game", async () => {
  const { api } = harness();
  const first = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001" }));
  const firstGame = (await first.clone().json()).data;
  const second = await api.start(post("/api/v1/ranked-games", { requestId: "request-0002" }));
  const secondCookie = cookieFrom(second);
  const read = await api.get(new Request(`${origin}/api/v1/ranked-games/${firstGame.gameId}`, {
    headers: { cookie: secondCookie }
  }), firstGame.gameId);
  assert.equal(read.status, 404);
  assert.equal((await read.json()).error.message, "Ranked game does not exist.");
});

test("request guard is mandatory and can stop abuse before domain writes", async () => {
  const service = new RankedGameService(
    new InMemoryRankedGameRepository(),
    { drawLocations: async () => [location()] },
    { gameId: () => "game-0001", roundId: () => "round-0001" },
    { roundCount: 1 }
  );
  const api = new RankedGameHttpApi(
    service,
    new RankedGuestSessionCodec([secret]),
    { read: async () => null },
    { check: async () => ({ allowed: false, retryAfterSeconds: 30 }) },
    { read: async () => null },
    { expectedOrigin: origin, now: () => 1_000 }
  );
  const response = await api.start(post("/api/v1/ranked-games", { requestId: "request-0001" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.equal((await response.json()).error.code, "rate_limited");
});
