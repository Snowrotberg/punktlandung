import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeOnlineRoomCode,
  onlineRoomCodeValidationMessage,
  onlineRoomInviteUrl,
  onlineRoomPath
} from "../lib/onlineRoomInvite";

test("online room codes are normalized and validated against server codes", () => {
  assert.equal(normalizeOnlineRoomCode(" q6-pr3g "), "Q6PR3G");
  assert.equal(onlineRoomCodeValidationMessage("Q6PR3G"), null);
  assert.equal(onlineRoomCodeValidationMessage("Q6P"), "Ein Raumcode besteht aus 6 Zeichen.");
  assert.equal(onlineRoomCodeValidationMessage("Q1PR3G"), "Dieser Raumcode enthält ungültige Zeichen.");
});

test("new invitation links use the canonical online route", () => {
  assert.equal(onlineRoomPath("q6pr3g"), "/online-modus?room=Q6PR3G");
  assert.equal(
    onlineRoomInviteUrl("https://punktlandung.app/alter/pfad?ignored=1", "q6pr3g").toString(),
    "https://punktlandung.app/online-modus?room=Q6PR3G"
  );
});

test("legacy root invitations redirect while invalid query codes still initialize setup", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const gameApp = readFileSync(new URL("../components/GameApp.tsx", import.meta.url), "utf8");
  const setup = readFileSync(new URL("../components/redesign/RedesignSetupView.tsx", import.meta.url), "utf8");
  assert.match(home, /redirect\(onlineRoomPath\(authParams\.room\)\)/);
  assert.match(gameApp, /initialMode !== "home" && !room && !pendingJoinCode/);
  assert.match(gameApp, /if \(pendingJoinCode && !onlineGame\.room\)/);
  assert.match(gameApp, /requestedRoomCode && !onlineRoomCodeValidationMessage\(normalizeOnlineRoomCode\(requestedRoomCode\)\)/);
  assert.match(gameApp, /setPendingJoinCode\(null\);\s+setJoinCodeError\(validationMessage\)/);
  assert.match(setup, /<form action="\/online-modus" method="get"/);
  assert.match(setup, /name="room"[^>]*required minLength=\{6\} maxLength=\{6\}/);
});
