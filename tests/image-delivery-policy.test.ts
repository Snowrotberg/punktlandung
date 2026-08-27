import assert from "node:assert/strict";
import test from "node:test";
import { directImageFallbackDelayMs, gameplayImageWidth, normalizeEffectiveConnectionType } from "../lib/imageDelivery";

test("gameplay images match the viewport while remaining bounded", () => {
  assert.equal(gameplayImageWidth(390, 2, { effectiveType: "4g" }), 1000);
  assert.equal(gameplayImageWidth(1280, 2, { effectiveType: "4g" }), 3200);
  assert.equal(gameplayImageWidth(360, 1, { effectiveType: "4g" }), 800);
  assert.equal(gameplayImageWidth(1920, 1, { effectiveType: "4g" }), 2200);
  assert.equal(gameplayImageWidth(3840, 1, { effectiveType: "4g" }), 3840);
});

test("object-cover sizing includes panoramic crop width and high-density displays", () => {
  assert.equal(gameplayImageWidth(1366, 2, { effectiveType: "4g" }, {
    viewportHeight: 768,
    sourceWidth: 6000,
    sourceHeight: 2000
  }), 3840);
  assert.equal(gameplayImageWidth(430, 3, { effectiveType: "4g" }, {
    viewportHeight: 300,
    sourceWidth: 2560,
    sourceHeight: 1440
  }), 1600);
});

test("slow or data-saving connections avoid oversized prefetches", () => {
  assert.equal(gameplayImageWidth(1280, 2, { effectiveType: "3g" }), 1000);
  assert.equal(gameplayImageWidth(1280, 2, { effectiveType: "2g" }), 800);
  assert.equal(gameplayImageWidth(1280, 2, { effectiveType: "4g", saveData: true }), 800);
});

test("direct fallback waits longer when a slow connection is still making progress", () => {
  assert.equal(directImageFallbackDelayMs("4g"), 3200);
  assert.equal(directImageFallbackDelayMs("3g"), 5000);
  assert.equal(directImageFallbackDelayMs("2g"), 6500);
  assert.equal(normalizeEffectiveConnectionType("unexpected"), "unknown");
});
