import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the consolidated account and ranking help returns to the shared overview", async () => {
  const source = await readSource("../components/HelpTopicPage.tsx");

  assert.match(source, /HelpBackLink/);
  assert.match(source, /rankings:/);
  for (const retiredTopic of ["spielablauf:", "punkte:", "konten:"]) {
    assert.doesNotMatch(source, new RegExp(retiredTopic));
  }
  assert.match(source, /AccountFlowDiagram/);
  assert.match(source, /Berechnung und aktuelle Faktoren ansehen/);
  assert.match(source, /Prüfung gegen Missbrauch/);
});

test("retired help detail routes permanently redirect to their consolidated destinations", async () => {
  const [flow, score, account] = await Promise.all([
    readSource("../app/faq/spielablauf/page.tsx"),
    readSource("../app/faq/punkte/page.tsx"),
    readSource("../app/faq/konten/page.tsx")
  ]);

  assert.match(flow, /permanentRedirect\("\/so-funktioniert-punktlandung#spielablauf"\)/);
  assert.match(score, /permanentRedirect\("\/so-funktioniert-punktlandung#punkte"\)/);
  assert.match(account, /permanentRedirect\("\/faq\/rankings#konto-verlauf"\)/);
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

test("FAQ is the shared help and info hub while feedback stays independent", async () => {
  const [faq, infos, rules, navigation, footer] = await Promise.all([
    readSource("../app/faq/page.tsx"),
    readSource("../app/infos/page.tsx"),
    readSource("../app/so-funktioniert-punktlandung/page.tsx"),
    readSource("../components/SectionNavigation.tsx"),
    readSource("../components/LegalLinks.tsx")
  ]);

  assert.match(faq, /eyebrow="Hilfe & Infos"/);
  for (const href of ["/so-funktioniert-punktlandung", "/faq/rankings", "/ortskatalog", "/partyspiel-geografie", "/infos"]) {
    assert.ok(faq.includes(`"${href}"`), href);
  }
  assert.doesNotMatch(faq, /\/feedback|community#vorschlagen/);
  assert.doesNotMatch(infos, /ModesAndContentDiagram|ContributionPaths/);
  assert.match(navigation, /label: "Spielen & Punkte"/);
  assert.match(navigation, /label: "Konto & Rankings"/);
  assert.match(navigation, /label: "Orte & Quellen"/);
  assert.match(navigation, /label: "Mit Freunden spielen"/);
  assert.match(navigation, /href: "\/infos", label: "Über Punktlandung"/);
  assert.doesNotMatch(navigation, /href: "\/feedback"/);
  assert.match(footer, /href: "\/faq", label: "Hilfe & Infos"/);
  assert.match(footer, /href: "\/feedback", label: "Feedback"/);
  assert.match(rules, /GameFlowDiagram/);
  assert.match(rules, /ScoreDiagram/);
});

test("all consolidated help detail pages provide a shared return path", async () => {
  const [rules, catalog, party, infos, backLink] = await Promise.all([
    readSource("../app/so-funktioniert-punktlandung/page.tsx"),
    readSource("../app/ortskatalog/page.tsx"),
    readSource("../app/partyspiel-geografie/page.tsx"),
    readSource("../app/infos/page.tsx"),
    readSource("../components/HelpBackLink.tsx")
  ]);

  for (const page of [rules, catalog, party, infos]) assert.match(page, /<HelpBackLink \/>/);
  assert.match(backLink, /href="\/faq"/);
  assert.match(backLink, /Zurück zu Hilfe &amp; Infos/);
  assert.doesNotMatch(rules, /Inhaltlich geprüft/);
});

test("editorial cards use visual signposts and the current target badge", async () => {
  const [rules, catalog, party, explainers, explainerStyles] = await Promise.all([
    readSource("../app/so-funktioniert-punktlandung/page.tsx"),
    readSource("../app/ortskatalog/page.tsx"),
    readSource("../app/partyspiel-geografie/page.tsx"),
    readSource("../components/EditorialExplainers.tsx"),
    readSource("../components/EditorialExplainers.module.css")
  ]);

  for (const icon of ["SlidersHorizontal", "ListOrdered", "Clock3", "Gauge", "UserRound", "UsersRound", "Globe2"]) assert.match(rules, new RegExp(icon));
  for (const icon of ["Building2", "Crown", "Landmark", "Mountain", "Flag"]) assert.match(catalog, new RegExp(icon));
  for (const icon of ["UsersRound", "SlidersHorizontal", "ListChecks", "Target", "Tv", "Globe2"]) assert.match(party, new RegExp(icon));
  assert.match(explainers, /styles\.targetLabel/);
  assert.match(explainerStyles, /\.targetLabel::before \{ display: none !important; \}/);
});
