import assert from "node:assert/strict";
import test from "node:test";
import { SafeRankedPromptAssetReader } from "../lib/rankedPromptAssetReader.server";

const allowedUrl = "https://images.example/prompt.jpg";

function reader(responses: Response[], maxBytes = 100) {
  let calls = 0;
  const fetchImpl = (async () => {
    const response = responses[calls];
    calls += 1;
    if (!response) throw new Error("Unexpected fetch");
    return response;
  }) as typeof fetch;
  return {
    assetReader: new SafeRankedPromptAssetReader({
      allowedHosts: ["images.example"],
      fetchImpl,
      maxBytes,
      timeoutMs: 1_000
    }),
    calls: () => calls
  };
}

test("safe prompt reader accepts a bounded raster image", async () => {
  const { assetReader } = reader([new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": "3" }
  })]);
  const asset = await assetReader.read(allowedUrl);
  assert.equal(asset?.contentType, "image/jpeg");
  assert.deepEqual(Array.from(new Uint8Array(asset?.bytes ?? new ArrayBuffer(0))), [1, 2, 3]);
});

test("Wikimedia SVG prompts are requested as passive raster thumbnails", async () => {
  const requested: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    requested.push(input.toString());
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png", "content-length": "3" }
    });
  }) as typeof fetch;
  const assetReader = new SafeRankedPromptAssetReader({ fetchImpl });

  const asset = await assetReader.read("https://commons.wikimedia.org/wiki/Special:FilePath/Flag%20of%20Mali.svg");

  assert.equal(asset?.contentType, "image/png");
  const requestedUrl = new URL(requested[0]);
  assert.equal(requestedUrl.pathname, "/wiki/Special:Redirect/file/Flag%20of%20Mali.svg");
  assert.equal(requestedUrl.searchParams.get("width"), "1200");
});

test("original Wikimedia uploads are requested as bounded thumbnails", async () => {
  const requested: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    requested.push(input.toString());
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": "3" }
    });
  }) as typeof fetch;
  const assetReader = new SafeRankedPromptAssetReader({ fetchImpl });

  await assetReader.read("https://upload.wikimedia.org/wikipedia/commons/a/ab/Very_large_photo.jpg");

  const requestedUrl = new URL(requested[0]);
  assert.equal(requestedUrl.hostname, "commons.wikimedia.org");
  assert.equal(requestedUrl.pathname, "/wiki/Special:Redirect/file/Very_large_photo.jpg");
  assert.equal(requestedUrl.searchParams.get("width"), "1200");
});

test("safe prompt reader rejects untrusted hosts before network access", async () => {
  const { assetReader, calls } = reader([]);
  assert.equal(await assetReader.read("http://127.0.0.1/private"), null);
  assert.equal(await assetReader.read("https://images.example@127.0.0.1/private"), null);
  assert.equal(await assetReader.read("https://images.example:8443/private"), null);
  assert.equal(calls(), 0);
});

test("redirects are revalidated and cannot escape to an internal host", async () => {
  const { assetReader, calls } = reader([new Response(null, {
    status: 302,
    headers: { location: "http://127.0.0.1/metadata" }
  })]);
  assert.equal(await assetReader.read(allowedUrl), null);
  assert.equal(calls(), 1);
});

test("oversized and active SVG responses are rejected", async () => {
  const oversized = reader([new Response(new Uint8Array([1]), {
    headers: { "content-type": "image/jpeg", "content-length": "101" }
  })]);
  assert.equal(await oversized.assetReader.read(allowedUrl), null);

  const svg = reader([new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })]);
  assert.equal(await svg.assetReader.read(allowedUrl), null);
});
