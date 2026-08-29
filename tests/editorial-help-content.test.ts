import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("all help topics provide one unambiguous route back to the FAQ overview", async () => {
  const source = await readSource("../components/HelpTopicPage.tsx");

  assert.match(source, /href="\/faq"/);
  assert.match(source, /Zurück zur Hilfe-Übersicht/);
  assert.deepEqual(
    ["spielablauf", "punkte", "konten", "rankings"].filter((topic) => source.includes(`${topic}:`)),
    ["spielablauf", "punkte", "konten", "rankings"]
  );
});

test("editorial diagrams are semantic code-native explanations", async () => {
  const source = await readSource("../components/EditorialExplainers.tsx");
  const gameFlow = source.slice(source.indexOf("export function GameFlowDiagram"), source.indexOf("export function ScoreDiagram"));

  for (const diagram of ["GameFlowDiagram", "ScoreDiagram", "AccountFlowDiagram", "RankingScopeDiagram", "ModesAndContentDiagram"]) {
    assert.match(source, new RegExp(`export function ${diagram}\\(`), diagram);
  }
  assert.match(source, /<figure/);
  assert.match(source, /<figcaption/);
  assert.match(source, /aria-label=/);
  assert.match(gameFlow, /stepNumberInline/);
  assert.doesNotMatch(gameFlow, /className=\{styles\.stepNumber\}/);
  assert.doesNotMatch(source, /<img\b/);
  assert.doesNotMatch(source, /Screenshot/i);
  assert.doesNotMatch(source, /Prinzipdarstellung/);
});

test("the compact game-flow help avoids repeating the detailed explainer", async () => {
  const [helpTopic, rules] = await Promise.all([
    readSource("../components/HelpTopicPage.tsx"),
    readSource("../app/so-funktioniert-punktlandung/page.tsx")
  ]);

  assert.doesNotMatch(helpTopic, /GameFlowDiagram/);
  assert.match(rules, /GameFlowDiagram/);
});

test("score diagram reuses the production result marker and route primitives", async () => {
  const [editorial, primitives, globe] = await Promise.all([
    readSource("../components/EditorialExplainers.tsx"),
    readSource("../components/ResultMapPrimitives.tsx"),
    readSource("../components/GlobeMapLab.tsx")
  ]);
  const scoreDiagram = editorial.slice(editorial.indexOf("export function ScoreDiagram"), editorial.indexOf("export function AccountFlowDiagram"));

  assert.match(scoreDiagram, /ResultMarkerGraphic kind="guess"/);
  assert.match(scoreDiagram, /ResultMarkerGraphic kind="target"/);
  assert.match(scoreDiagram, /ResultRouteGraphic label="500 km"/);
  assert.doesNotMatch(scoreDiagram, /<MapPin/);
  assert.match(primitives, /resultMarkerGraphicMarkup/);
  assert.match(primitives, /resultRouteLineClassName/);
  assert.match(globe, /resultMarkerGraphicMarkup\(kind, \{ pin: styles\.markerPin, rings: styles\.markerRings \}\)/);
  assert.match(globe, /resultRouteLineClassName/);
});

test("FAQ keeps a compact, complete set of next steps and info pages use the shared diagrams", async () => {
  const [faq, infos, rules] = await Promise.all([
    readSource("../app/faq/page.tsx"),
    readSource("../app/infos/page.tsx"),
    readSource("../app/so-funktioniert-punktlandung/page.tsx")
  ]);

  assert.match(faq, /Hilfe · Übersicht/);
  for (const href of ["/infos", "/feedback", "/community#vorschlagen"]) {
    assert.ok(faq.includes(`["${href}"`), href);
  }
  assert.doesNotMatch(faq, /ContributionPaths/);
  assert.match(infos, /ModesAndContentDiagram/);
  assert.match(rules, /GameFlowDiagram/);
  assert.match(rules, /ScoreDiagram/);
});
