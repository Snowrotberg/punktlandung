import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { metadataForRoomInvite, onlineRoomMetadata } from "../lib/seo";

const root = process.cwd();

test("the cache-busting social image is a 1200 by 630 JPEG", async () => {
  const imagePath = path.join(root, "public", "punktlandung-share-v2.jpg");
  const metadata = await sharp(await readFile(imagePath)).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});

test("the online room metadata is absolute, shareable and remains noindex", () => {
  const openGraphImages = Array.isArray(onlineRoomMetadata.openGraph?.images)
    ? onlineRoomMetadata.openGraph.images
    : [onlineRoomMetadata.openGraph?.images];
  const twitterImages = Array.isArray(onlineRoomMetadata.twitter?.images)
    ? onlineRoomMetadata.twitter.images
    : [onlineRoomMetadata.twitter?.images];
  const image = openGraphImages[0];
  const robots = onlineRoomMetadata.robots && typeof onlineRoomMetadata.robots === "object"
    ? onlineRoomMetadata.robots
    : undefined;
  assert.equal(typeof image === "object" && "url" in image ? image.url : image, "https://punktlandung.app/punktlandung-share-v2.jpg");
  assert.equal(twitterImages[0], "https://punktlandung.app/punktlandung-share-v2.jpg");
  assert.equal(onlineRoomMetadata.alternates?.canonical, "https://punktlandung.app/online-modus");
  assert.equal(robots?.index, false);
  assert.equal(robots?.follow, false);
  assert.doesNotMatch(JSON.stringify(onlineRoomMetadata), /room=/i);
});

test("root room invitations receive room metadata without exposing their code", async () => {
  const metadata = metadataForRoomInvite("ABCD12");
  assert.deepEqual(metadata, onlineRoomMetadata);
  assert.doesNotMatch(JSON.stringify(metadata), /ABCD12/);
  assert.deepEqual(metadataForRoomInvite(undefined), {});
});
