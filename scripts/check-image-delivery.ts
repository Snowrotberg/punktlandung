import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { GET } from "../app/api/image/route";
import type { GeoLocation } from "../types/game";

async function main() {
  const catalogUrl = new URL("../data/generated/locations.generated.json", import.meta.url);
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as GeoLocation[];
  const sampleCount = Math.max(1, Math.min(catalog.length, Number(process.env.IMAGE_CHECK_COUNT) || 6));
  const categoryBuckets = new Map<string, GeoLocation[]>();

  for (const location of catalog) {
    const bucket = categoryBuckets.get(location.category) ?? [];
    bucket.push(location);
    categoryBuckets.set(location.category, bucket);
  }

  const buckets = Array.from(categoryBuckets.values());
  const samples: GeoLocation[] = [];
  for (let bucketIndex = 0; samples.length < sampleCount; bucketIndex += 1) {
    let added = false;
    for (const bucket of buckets) {
      const location = bucket[bucketIndex];
      if (!location || samples.length >= sampleCount) continue;
      samples.push(location);
      added = true;
    }
    if (!added) break;
  }
  let failures = 0;

  for (const location of samples) {
    const requestUrl = new URL("http://punktlandung.test/api/image");
    requestUrl.searchParams.set("src", location.panoramaUrl);
    requestUrl.searchParams.set("w", "1400");

    const startedAt = performance.now();
    const response = await GET(new NextRequest(requestUrl));
    const bytes = await response.arrayBuffer();
    const durationMs = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get("content-type") ?? "";
    const passed = response.status === 200 && contentType.startsWith("image/") && bytes.byteLength > 0;
    if (!passed) failures += 1;

    console.log(
      JSON.stringify({
        id: location.id,
        category: location.category,
        status: response.status,
        contentType,
        bytes: bytes.byteLength,
        durationMs,
        passed
      })
    );
  }

  if (failures > 0) {
    console.error(`${failures} von ${samples.length} Bildabrufen sind fehlgeschlagen.`);
    process.exitCode = 1;
  } else {
    console.log(`${samples.length} von ${samples.length} Bildabrufen erfolgreich.`);
  }

  if (process.env.IMAGE_CHECK_FAILURE === "true") {
    const missingUrl = new URL("http://punktlandung.test/api/image");
    missingUrl.searchParams.set(
      "src",
      "https://commons.wikimedia.org/wiki/Special:FilePath/Punktlandung-delivery-check-file-does-not-exist.jpg"
    );
    missingUrl.searchParams.set("w", "1400");
    const missingStartedAt = performance.now();
    const missingResponse = await GET(new NextRequest(missingUrl));
    const missingDurationMs = Math.round(performance.now() - missingStartedAt);
    const boundedFailure = missingResponse.status === 502 && missingDurationMs <= 22000;
    console.log(JSON.stringify({ test: "missing-image", status: missingResponse.status, durationMs: missingDurationMs, passed: boundedFailure }));
    if (!boundedFailure) process.exitCode = 1;
  }
}

void main();
