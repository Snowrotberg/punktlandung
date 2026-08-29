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

  for (const diagram of ["GameFlowDiagram", "ScoreDiagram", "AccountFlowDiagram", "RankingScopeDiagram", "ModesAndContentDiagram"]) {
    assert.match(source, new RegExp(`export function ${diagram}\\(`), diagram);
  }
  assert.match(source, /<figure/);
  assert.match(source, /<figcaption/);
  assert.match(source, /aria-label=/);
  assert.match(source, /stepNumberInline/);
  assert.doesNotMatch(source, /<img\b/);
  assert.doesNotMatch(source, /Screenshot/i);
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
