import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../app/api/usage/route";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/usage", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("image delivery metrics are bounded, anonymous and persist the catalog key", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "punktlandung-usage-"));
  const metricsPath = path.join(directory, "events.ndjson");
  const previousPath = process.env.USAGE_METRICS_FILE;
  process.env.USAGE_METRICS_FILE = metricsPath;
  try {
    const response = await POST(request({
      event: "image_delivery",
      category: "cities",
      durationMs: 842,
      outcome: "loaded",
      delivery: "direct",
      cacheHit: false,
      connectionType: "4g",
      locationId: "cities-berlin-q64"
    }));
    assert.equal(response.status, 200);
    const stored = JSON.parse((await readFile(metricsPath, "utf8")).trim());
    assert.equal(stored.event, "image_delivery");
    assert.equal(stored.locationId, "cities-berlin-q64");
    assert.equal(stored.durationMs, 842);
    assert.equal("imageUrl" in stored, false);
    assert.equal("userId" in stored, false);

    const invalid = await POST(request({
      event: "image_delivery",
      category: "cities",
      durationMs: 842,
      outcome: "loaded",
      delivery: "direct",
      cacheHit: false,
      connectionType: "4g",
      locationId: "../../private"
    }));
    assert.equal(invalid.status, 400);
  } finally {
    if (previousPath === undefined) delete process.env.USAGE_METRICS_FILE;
    else process.env.USAGE_METRICS_FILE = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});

test("page analytics accept only coarse anonymous viewport and engagement data", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "punktlandung-pages-"));
  const metricsPath = path.join(directory, "events.ndjson");
  const previousPath = process.env.USAGE_METRICS_FILE;
  process.env.USAGE_METRICS_FILE = metricsPath;
  const context = {
    path: "/konto/verlauf/[spiel]",
    visitId: "4ca762cc-9388-4a12-b1cf-6dd8bce72aad",
    deviceClass: "phone",
    viewportBucket: "360–479"
  };
  try {
    assert.equal((await POST(request({ event: "page_view", ...context }))).status, 200);
    assert.equal((await POST(request({ event: "page_engagement", ...context, durationMs: 12_500 }))).status, 200);
    assert.equal((await POST(request({ event: "page_view", ...context, path: "/konto?email=privat@example.org" }))).status, 400);
    assert.equal((await POST(request({ event: "page_view", ...context, deviceClass: "Pixel 9" }))).status, 400);

    const stored = (await readFile(metricsPath, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.deepEqual(stored.map((event) => event.event), ["page_view", "page_engagement"]);
    assert.equal(stored[1].durationMs, 12_500);
    assert.equal("userAgent" in stored[0], false);
    assert.equal("email" in stored[0], false);
  } finally {
    if (previousPath === undefined) delete process.env.USAGE_METRICS_FILE;
    else process.env.USAGE_METRICS_FILE = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
