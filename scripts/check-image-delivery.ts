import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { GET } from "../app/api/image/route";
import type { GeoLocation } from "../types/game";

async function main() {
  const sampleCount = Math.max(1, Math.min(20, Number(process.env.IMAGE_CHECK_COUNT) || 6));
  const catalogUrl = new URL("../data/generated/locations.generated.json", import.meta.url);
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as GeoLocation[];
  const categorySamples = new Map<string, GeoLocation>();

  for (const location of catalog) {
    if (!categorySamples.has(location.category)) categorySamples.set(location.category, location);
    if (categorySamples.size >= sampleCount) break;
  }

  const samples = Array.from(categorySamples.values()).slice(0, sampleCount);
  const selectedIds = new Set(samples.map((location) => location.id));
  for (const location of catalog) {
    if (samples.length >= sampleCount) break;
    if (selectedIds.has(location.id)) continue;
    selectedIds.add(location.id);
    samples.push(location);
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
