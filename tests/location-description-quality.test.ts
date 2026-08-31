import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import descriptionAuditJson from "../data/generated/location-description-audit.generated.json";
import { builtInLocations } from "../data/locations";
import {
  locationDescriptionCatalogFingerprint,
  locationDescriptionIssues
} from "../lib/locationDescriptionQuality";

test("every active target has a concise sourced description", () => {
  assert.ok(builtInLocations.every((location) => locationDescriptionIssues(location).length === 0));
  assert.equal(descriptionAuditJson.activeLocationCount, builtInLocations.length);
  assert.equal(descriptionAuditJson.completeDescriptionCount, builtInLocations.length);
  assert.equal(descriptionAuditJson.completeProvenanceCount, builtInLocations.length);
  assert.equal(descriptionAuditJson.violationCount, 0);
  assert.equal(descriptionAuditJson.catalogFingerprint, locationDescriptionCatalogFingerprint(builtInLocations));
});

test("description guard rejects filler, fragments and missing provenance", () => {
  assert.deepEqual(locationDescriptionIssues({
    shortDescription: "Das Tor ist eines der bekanntesten Wahrzeichen.",
    descriptionSourceUrl: "https://de.wikipedia.org/wiki/Beispiel"
  }), ["generic-filler"]);
  assert.deepEqual(locationDescriptionIssues({
    shortDescription: "Volos (griechisch Βόλος (m. sg.",
    descriptionSourceUrl: undefined
  }), ["missing-provenance", "sentence-fragment"]);
  assert.deepEqual(locationDescriptionIssues({
    shortDescription: "Ein künstlich gekürzter Satz…",
    descriptionSourceUrl: "https://de.wikipedia.org/wiki/Beispiel"
  }), ["artificial-ellipsis"]);
});

test("the Brandenburger Tor preview gives a concrete sourced-style fact instead of a fame tautology", () => {
  const source = readFileSync(new URL("../components/HomeMapPreview.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /eines der bekanntesten Wahrzeichen/);
  assert.match(source, /zwischen 1788 und 1791/);
  assert.match(source, /Abschluss der Straße Unter den Linden/);
});
