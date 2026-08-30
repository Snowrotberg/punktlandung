import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sitemap from "../app/sitemap";
import { isEditorialAdRoute } from "../lib/adRoutePolicy";
import { absoluteUrl } from "../lib/seo";

test("AdSense is limited to substantial editorial routes", () => {
  for (const pathname of [
    "/infos",
    "/so-funktioniert-punktlandung",
    "/ortskatalog",
    "/partyspiel-geografie",
    "/faq",
    "/faq/punkte/"
  ]) {
    assert.equal(isEditorialAdRoute(pathname), true, pathname);
  }

  for (const pathname of [
    "/",
    "/solo-modus",
    "/spielen",
    "/aufloesung",
    "/endergebnis",
    "/rankings",
    "/konto",
    "/community",
    "/anmelden",
    "/datenschutz",
    "/impressum"
  ]) {
    assert.equal(isEditorialAdRoute(pathname), false, pathname);
  }
});

test("sitemap contains only the canonical help and info pages", () => {
  const urls = new Set(sitemap().map((entry) => entry.url));
  for (const pathname of ["/faq", "/faq/rankings", "/infos", "/so-funktioniert-punktlandung", "/ortskatalog", "/partyspiel-geografie"]) {
    assert.equal(urls.has(absoluteUrl(pathname)), true, pathname);
  }
  for (const pathname of ["/faq/spielablauf", "/faq/punkte", "/faq/konten"]) {
    assert.equal(urls.has(absoluteUrl(pathname)), false, pathname);
  }
});

test("homepage has one semantic title instead of responsive duplicate text", async () => {
  const source = await readFile(new URL("../components/redesign/RedesignHomeView.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/Wie gut/g)?.length, 1);
  assert.equal(source.match(/die Welt\?/g)?.length, 1);
  assert.match(source, /Wie gut<br[^>]+\/> kennst<br[^>]+\/> du<br[^>]+\/> die Welt\?/);
});
