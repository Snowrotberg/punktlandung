import test from "node:test";
import assert from "node:assert/strict";
import { PLAYER_PALETTE, playerColorAt, playerColorForId } from "../lib/playerPalette";

test("party players use one stable set of ten unique colors", () => {
  assert.deepEqual(PLAYER_PALETTE, [
    "#ff4775",
    "#938cff",
    "#fb923c",
    "#4e8eff",
    "#f6c94c",
    "#22c55e",
    "#e879f9",
    "#22d3ee",
    "#a3e635",
    "#93a4ba"
  ]);
  assert.equal(new Set(PLAYER_PALETTE.map((color) => color.toLowerCase())).size, 10);
});

test("playerColorAt keeps the same color assignment across every consumer", () => {
  PLAYER_PALETTE.forEach((color, index) => assert.equal(playerColorAt(index), color));
  assert.equal(playerColorAt(10), PLAYER_PALETTE[0]);
});

test("playerColorForId ignores stale saved colors and follows player order", () => {
  const players = [
    { id: "one", color: "#ffffff" },
    { id: "two", color: "#ff0000" },
    { id: "ten", color: "#000000" }
  ];

  assert.equal(playerColorForId(players, "one"), PLAYER_PALETTE[0]);
  assert.equal(playerColorForId(players, "two"), PLAYER_PALETTE[1]);
  assert.equal(playerColorForId(players, "ten"), PLAYER_PALETTE[2]);
  assert.equal(playerColorForId(players, "missing", 9), PLAYER_PALETTE[9]);
});
