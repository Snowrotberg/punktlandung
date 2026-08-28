import assert from "node:assert/strict";
import test from "node:test";
import {
  imageCommonsSourceHref,
  imageFileNameForLicense,
  imageLicenseCatalogFileName,
  imageLicenseEntryFileNames,
  imageLicenseEntryId,
  imageLicenseEntryMatchesFile,
  imageLicenseHref,
  normalizeImageLicenseFileName
} from "../lib/imageLicenseLink";

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

test("builds an actionable Commons source link for a missing local entry", () => {
  assert.equal(
    imageCommonsSourceHref("Palácio Nacional da Pena por Rodrigo Tetsuo Argenton (15).jpg"),
    "https://commons.wikimedia.org/wiki/File:Pal%C3%A1cio_Nacional_da_Pena_por_Rodrigo_Tetsuo_Argenton_(15).jpg"
  );
});

test("matches catalogue aliases and Wikimedia redirects without duplicate records", () => {
  const entry = {
    fileName: "Brandenburg Gate at night.jpg",
    catalogFileName: "Brandenburger Tor abends.jpg",
    catalogFileNames: ["Brandenburger Tor abends.jpg", "Brandenburger_Tor_abends.jpg"]
  };

  assert.equal(imageLicenseCatalogFileName(entry), "Brandenburger Tor abends.jpg");
  assert.deepEqual(imageLicenseEntryFileNames(entry), [
    "Brandenburger Tor abends.jpg",
    "Brandenburger_Tor_abends.jpg",
    "Brandenburg Gate at night.jpg"
  ]);
  assert.equal(imageLicenseEntryMatchesFile(entry, "Brandenburger_Tor_abends.jpg"), true);
  assert.equal(imageLicenseEntryMatchesFile(entry, "Brandenburg_Gate_at_night.jpg"), true);
  assert.equal(imageLicenseEntryMatchesFile(entry, "another-file.jpg"), false);
});

test("admin license navigation preserves exact queries and stable fragments", () => {
  const files = [
    "Brandenburger_Tor_abends.jpg",
    "Palácio Nacional da Pena por Rodrigo Tetsuo Argenton (15).jpg",
    "Waldenburg-Schloss-Fürstenstein-Schlosspark-IMG 5610-5x5B-360x180G-PanoS-05-08-2024.jpg"
  ];

  for (const fileName of files) {
    assert.equal(
      imageLicenseHref(fileName),
      `/lizenzen?bild=${encodeURIComponent(fileName)}#${imageLicenseEntryId(fileName)}`
    );
  }
});

test("the displayed multiplication sign resolves only for dimension-like lookup aliases", () => {
  const asciiFileName = "Waldenburg-Schloss-Fürstenstein-Schlosspark-IMG 5610-5x5B-360x180G-PanoS-05-08-2024.jpg";
  const displayedFileName = "Waldenburg-Schloss-Fürstenstein-Schlosspark-IMG 5610-5×5B-360×180G-PanoS-05-08-2024.jpg";

  assert.notEqual(normalizeImageLicenseFileName(asciiFileName), normalizeImageLicenseFileName(displayedFileName));
  assert.equal(imageLicenseEntryMatchesFile({ fileName: asciiFileName }, displayedFileName), true);
});

test("derives Wikimedia file names when older catalogue rows lack imageFile", () => {
  assert.equal(imageFileNameForLicense({
    panoramaUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Festung_Hohensalzburg.jpg?width=1200"
  }), "Festung_Hohensalzburg.jpg");
  assert.equal(imageFileNameForLicense({
    panoramaUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Example_image.jpg"
  }), "Example_image.jpg");
});
