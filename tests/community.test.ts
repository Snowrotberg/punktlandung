import assert from "node:assert/strict";
import test from "node:test";
import { cleanCommunityDetails, cleanCommunityTitle, communityAuthorLabel, communityPublicMetrics, communityPublicStatuses, relatedCommunitySuggestions, validateCommunitySuggestion } from "../lib/community";

test("community suggestion input is normalized and bounded", () => {
  assert.equal(cleanCommunityTitle("  Eigene   Kartenrunden  "), "Eigene Kartenrunden");
  assert.equal(cleanCommunityDetails("  Erste Zeile\r\nZweite Zeile  "), "Erste Zeile\nZweite Zeile");
  assert.equal(cleanCommunityTitle("x".repeat(120)).length, 100);
  assert.equal(cleanCommunityDetails("x".repeat(2200)).length, 2000);
});

test("community suggestion validation requires useful detail", () => {
  assert.match(validateCommunitySuggestion("Hi", "Eine ausreichend lange Beschreibung") ?? "", /mindestens acht/);
  assert.match(validateCommunitySuggestion("Gute Idee", "Zu kurz") ?? "", /mindestens 20/);
  assert.equal(validateCommunitySuggestion("Gute Idee", "Eine konkrete und hilfreiche Beschreibung."), null);
});

test("pending and declined ideas are never public voting states", () => {
  assert.deepEqual([...communityPublicStatuses], ["approved", "planned", "in_progress", "completed"]);
});

test("community metrics count public ideas, planned ideas, and their votes", () => {
  assert.deepEqual(communityPublicMetrics([
    { status: "approved", voteCount: 2 },
    { status: "planned", voteCount: 1 },
    { status: "completed", voteCount: 3 },
    { status: "pending", voteCount: 50 },
    { status: "declined", voteCount: 50 }
  ]), {
    ideasInVoting: 3,
    plannedIdeas: 1,
    votesCast: 6
  });
});

test("community authors use the current public username, never the personal name", () => {
  assert.equal(communityAuthorLabel({ handle: "Timo", visibility: "public", status: "active" }), "@Timo");
  assert.equal(communityAuthorLabel({ handle: "Timo", visibility: "private", status: "active" }), "Punktlandung-Spieler");
  assert.equal(communityAuthorLabel({ handle: "Timo", visibility: "public", status: "deleted" }), "Punktlandung-Spieler");
});

test("guest suggestions keep a neutral public author label", () => {
  assert.equal(communityAuthorLabel(null), "Punktlandung-Spieler");
});

test("related suggestions prefer shared title terms and ignore generic words", () => {
  const suggestions = [
    { suggestionId: "one", title: "Eigene Bilderrunden speichern", details: "Runden mit Bildern später erneut spielen.", voteCount: 4 },
    { suggestionId: "two", title: "Neue Flaggen hinzufügen", details: "Mehr Länder in der Flaggen-Kategorie.", voteCount: 12 }
  ];
  const matches = relatedCommunitySuggestions("Ich möchte eigene Bilderrunden anlegen und speichern", suggestions);
  assert.deepEqual(matches.map((item) => item.suggestionId), ["one"]);
  assert.deepEqual(relatedCommunitySuggestions("Das wäre auch gut", suggestions), []);
});
