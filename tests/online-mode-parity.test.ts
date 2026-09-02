import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("online results use the shared Globe and celebrate only this device player", async () => {
  const results = await readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(results, /room\.kind !== "solo"/);
  assert.match(results, /ranked\.find\(\(result\) => result\.playerId === meId\) \?\? ranked\[0\]/);
  assert.match(results, /result\.playerId === meId && result\.guess/);
});

test("online players can rename themselves through the authoritative room server", async () => {
  const [messages, socket, server, waitingRoom] = await Promise.all([
    readFile(new URL("../types/game.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useOnlineRoomSocket.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/redesign/RedesignWaitingRoomView.tsx", import.meta.url), "utf8")
  ]);
  assert.match(messages, /type: "rename_player"; playerName: string/);
  assert.match(socket, /playerIdToRename !== playerId/);
  assert.match(server, /case "rename_player"/);
  assert.match(server, /player\.name = sanitizeName\(message\.playerName\)/);
  assert.match(waitingRoom, /aria-label="Deinen Spielernamen ändern"/);
});

test("image focus toggle avoids the browser native tooltip and final guests can leave", async () => {
  const results = await readFile(new URL("../components/ResultsView.tsx", import.meta.url), "utf8");
  assert.match(results, /data-tooltip=\{replayChromeSuppressed/);
  assert.doesNotMatch(results, /title=\{replayChromeSuppressed/);
  assert.match(results, />Raum verlassen</);
});
