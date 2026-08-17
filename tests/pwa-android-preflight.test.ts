import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import manifest from "../app/manifest";
import { mobileAppleWebApp, mobileViewport } from "../lib/mobileMetadata";

test("PWA manifest has a stable standalone identity and same-origin scope", () => {
  const value = manifest();
  assert.equal(value.id, "/");
  assert.equal(value.start_url, "/");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.lang, "de-DE");
  assert.equal(value.theme_color, "#020617");
  assert.equal(value.background_color, "#020617");
  assert.ok(value.name && value.short_name && value.description);
  assert.deepEqual(value.categories, ["games", "education"]);
});

test("declared PWA icons exist with exact raster dimensions", async () => {
  const value = manifest();
  assert.equal(value.icons?.length, 2);
  for (const icon of value.icons ?? []) {
    const match = /^(\d+)x(\d+)$/.exec(icon.sizes ?? "");
    assert.ok(match && icon.src?.startsWith("/") && icon.type === "image/png");
    const path = new URL(`../public${icon.src}`, import.meta.url);
    const image = sharp(await readFile(path));
    const info = await image.metadata();
    assert.equal(info.width, Number(match[1]));
    assert.equal(info.height, Number(match[2]));
    assert.equal(info.format, "png");
  }
});

test("mobile standalone metadata enables safe areas without locking orientation", () => {
  assert.equal(mobileViewport.viewportFit, "cover");
  assert.equal(mobileViewport.width, "device-width");
  assert.equal(mobileViewport.themeColor, "#020617");
  assert.deepEqual(mobileAppleWebApp, {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Punktlandung"
  });
  assert.equal(manifest().orientation, "any");
});

test("Digital Asset Links template is structurally valid and cannot be deployed accidentally", async () => {
  const raw = await readFile(new URL("../prototypes/android/assetlinks.template.json", import.meta.url), "utf8");
  const assetLinks = JSON.parse(raw);
  assert.equal(assetLinks.length, 1);
  assert.deepEqual(assetLinks[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(assetLinks[0].target.namespace, "android_app");
  assert.equal(assetLinks[0].target.package_name, "REPLACE_WITH_ANDROID_PACKAGE_NAME");
  assert.deepEqual(assetLinks[0].target.sha256_cert_fingerprints, [
    "REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT"
  ]);
});
