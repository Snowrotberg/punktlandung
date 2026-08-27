import assert from "node:assert/strict";
import test from "node:test";
import { imageFileNameForLicense, imageLicenseEntryId, imageLicenseHref, normalizeImageLicenseFileName } from "../lib/imageLicenseLink";

test("image license links target a stable exact catalogue entry", () => {
  const fileName = "Festung_Hohensalzburg – Salzburg.jpg";
  const href = imageLicenseHref(fileName);

  assert.equal(normalizeImageLicenseFileName(fileName), "festung hohensalzburg – salzburg.jpg");
  assert.match(imageLicenseEntryId(fileName), /^bild-[0-9a-f]{8}$/);
  assert.equal(href, `/lizenzen?bild=${encodeURIComponent(fileName)}#${imageLicenseEntryId(fileName)}`);
  assert.equal(imageLicenseEntryId(fileName), imageLicenseEntryId("Festung Hohensalzburg – Salzburg.jpg"));
});

test("missing image metadata falls back to the image-credit section", () => {
  assert.equal(imageLicenseHref(), "/lizenzen#bildnachweise");
});

test("derives Wikimedia file names when older catalogue rows lack imageFile", () => {
  assert.equal(imageFileNameForLicense({
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Festung_Hohensalzburg.jpg?width=1200"
  }), "Festung_Hohensalzburg.jpg");
  assert.equal(imageFileNameForLicense({
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Example_image.jpg"
  }), "Example_image.jpg");
});
