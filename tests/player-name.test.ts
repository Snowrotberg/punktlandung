import test from "node:test";
import assert from "node:assert/strict";
import { PLAYER_NAME_MAX_LENGTH, sanitizeEditablePlayerName, sanitizePlayerName } from "../lib/playerName";

test("player names use the documented 18-character contract everywhere", () => {
  assert.equal(PLAYER_NAME_MAX_LENGTH, 18);
  assert.equal(sanitizePlayerName("  Tabea mit Langname  "), "Tabea mit Langname");
  assert.equal(sanitizePlayerName("01234567890123456789"), "012345678901234567");
  assert.equal(sanitizeEditablePlayerName("Tabea<>? Spielerin"), "Tabea Spielerin");
  assert.equal(sanitizePlayerName("<>?"), "Gast");
});
