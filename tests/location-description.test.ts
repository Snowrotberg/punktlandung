import assert from "node:assert/strict";
import test from "node:test";
import { locationShortDescription, normalizeLocationDescription } from "../lib/locationDescription";

test("normalizes markup and keeps at most two short sentences", () => {
  assert.equal(normalizeLocationDescription("<b>Erster Satz.</b> Zweiter Satz! Dritter Satz?"), "Erster Satz. Zweiter Satz!");
});

test("limits overly long descriptions", () => {
  const result = normalizeLocationDescription("Ein sehr langer Ortstext ".repeat(30));
  assert.ok(result);
  assert.ok(result.length <= 240);
  assert.match(result, /…$/);
});

test("does not invent a generic fallback when editorial information is missing", () => {
  assert.equal(locationShortDescription({ title: "Berlin" }), undefined);
});

test("keeps a sourced location fact as a natural sentence", () => {
  assert.equal(
    locationShortDescription({ title: "Avignon", shortDescription: "Da Avignon lange Sitz des Papstes war, trägt die Stadt den Beinamen Stadt der Päpste." }),
    "Da Avignon lange Sitz des Papstes war, trägt die Stadt den Beinamen Stadt der Päpste."
  );
});

test("does not split abbreviations or parenthetical grammar notes into fragments", () => {
  assert.equal(normalizeLocationDescription("Volos (griechisch Βόλος (m. sg.)) liegt am Pagasitischen Golf. Der Hafen verbindet Thessalien mit den Sporaden."),
    "Volos (griechisch Βόλος (m. sg.)) liegt am Pagasitischen Golf. Der Hafen verbindet Thessalien mit den Sporaden.");
  assert.equal(normalizeLocationDescription("Stockholm blickt auf eine bis ins 13. Jahrhundert zurückreichende Besiedlungsgeschichte."),
    "Stockholm blickt auf eine bis ins 13. Jahrhundert zurückreichende Besiedlungsgeschichte.");
});

test("rejects stored fragments instead of presenting them as facts", () => {
  assert.equal(normalizeLocationDescription("Volos (griechisch Βόλος (m. sg."), null);
});
