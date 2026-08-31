import assert from "node:assert/strict";
import test from "node:test";
import { prepareLocationImage } from "../lib/imagePreload.client";
import type { GeoLocation } from "../types/game";

test("prepareLocationImage requests a quality-gate-safe panorama on a DPR 1 phone", async () => {
  const previousWindow = globalThis.window;
  const previousNavigator = globalThis.navigator;
  const previousImage = globalThis.Image;
  let requestedUrl = "";

  class LoadedPanorama {
    naturalWidth = 1400;
    naturalHeight = 482;
    decoding = "auto";
    fetchPriority = "auto";
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;

    set src(value: string) {
      requestedUrl = value;
      queueMicrotask(() => this.onload?.());
    }

    async decode() {}
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      devicePixelRatio: 1,
      innerHeight: 844,
      innerWidth: 390,
      location: { origin: "http://127.0.0.1:3012" },
      setTimeout
    }
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { connection: { effectiveType: "4g", saveData: false } }
  });
  Object.defineProperty(globalThis, "Image", { configurable: true, value: LoadedPanorama });

  try {
    const location = {
      category: "landscapes",
      imageHeight: 5_127,
      imageWidth: 14_896,
      panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Wide panorama.jpg"
    } as GeoLocation;

    const prepared = await prepareLocationImage(location);

    assert.ok(prepared);
    assert.equal(prepared.deliveryUrl, requestedUrl);
    assert.match(requestedUrl, /^\/api\/image\?/);
    assert.equal(new URL(requestedUrl, "http://127.0.0.1:3012").searchParams.get("w"), "1400");
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousNavigator });
    Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
  }
});
