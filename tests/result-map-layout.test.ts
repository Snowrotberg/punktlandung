import test from "node:test";
import assert from "node:assert/strict";
import { resultLabelLaneCandidates, resultMarkerZIndex } from "../lib/resultMapLayout";

test("result pin stack follows rank and always keeps the target above players", () => {
  const players = Array.from({ length: 10 }, (_, rank) => resultMarkerZIndex(rank));
  assert.deepEqual(players, [...players].sort((a, b) => b - a));
  assert.ok(players.every((value, index) => index === 0 || value < players[index - 1]));
  assert.ok(resultMarkerZIndex("target") > players[0]);
});

test("dense result labels receive enough deterministic safe lanes", () => {
  const input = {
    anchor: { x: 360, y: 210 },
    viewport: { width: 760, height: 440 },
    label: { width: 204, height: 44 },
    margin: 30,
    rightMargin: 82
  };
  const first = resultLabelLaneCandidates(input);
  const second = resultLabelLaneCandidates(input);
  assert.deepEqual(first, second);
  assert.ok(first.length >= 10);
  for (const lane of first) {
    const left = input.anchor.x + lane.dx - input.label.width / 2;
    const right = input.anchor.x + lane.dx + input.label.width / 2;
    const top = input.anchor.y + lane.dy - input.label.height / 2;
    const bottom = input.anchor.y + lane.dy + input.label.height / 2;
    assert.ok(left >= input.margin - 0.01);
    assert.ok(right <= input.viewport.width - input.rightMargin + 0.01);
    assert.ok(top >= input.margin - 0.01);
    assert.ok(bottom <= input.viewport.height - input.margin + 0.01);
  }
});

test("two-pin north-south semantics can restrict dense lanes to one side", () => {
  const lanes = resultLabelLaneCandidates({
    anchor: { x: 180, y: 300 },
    viewport: { width: 360, height: 800 },
    label: { width: 160, height: 40 },
    margin: 18,
    preferredVerticalSide: -1
  });
  assert.ok(lanes.length > 0);
  assert.ok(lanes.every((lane) => lane.dy < 0));
});
