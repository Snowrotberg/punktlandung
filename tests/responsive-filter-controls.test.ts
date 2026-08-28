import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile route selectors expose their label, selected value and URL links", async () => {
  const source = await read("components/ResponsiveRouteSelect.tsx");
  assert.match(source, /<summary aria-label=/);
  assert.match(source, /<nav aria-label=/);
  assert.match(source, /aria-current=.*page/);
  assert.match(source, /href=\{option\.href\}/);
  assert.match(source, /name="responsive-route-select"/);
});

test("selected filter states do not add decorative bullets", async () => {
  const sharedStyles = await read("components/ResponsiveRouteSelect.module.css");
  const rankingStyles = await read("app/rankings/page.module.css");
  assert.doesNotMatch(sharedStyles, /a\[aria-current="page"\]::before/);
  assert.doesNotMatch(rankingStyles, /filterOptions a\[aria-current="page"\]::before/);
});

test("history names points-per-round and total-score sorting unambiguously", async () => {
  const source = await read("app/konto/verlauf/page.tsx");
  assert.match(source, /Beste Punkte pro Runde/);
  assert.match(source, /Höchste Gesamtpunktzahl/);
  assert.doesNotMatch(source, /\["average", "Beste Ø-Punkte"\]/);
  assert.match(source, /category=\$\{value\}&sort=\$\{selectedSort\}/);
  assert.match(source, /category=\$\{selectedCategory\}&sort=\$\{value\}/);
});

test("rankings preserves the other active query parameter in each selector", async () => {
  const source = await read("app/rankings/page.tsx");
  assert.match(source, /period=\$\{value\}&category=\$\{category\}/);
  assert.match(source, /period=\$\{period\}&category=\$\{value\}/);
});

test("admin uses the same compact route selector with the selected period in the URL", async () => {
  const source = await read("app/admin/page.tsx");
  assert.match(source, /ResponsiveRouteSelect label="Zeitraum" value=\{periodKey\}/);
  assert.match(source, /href: `\/admin\?period=\$\{item\.key\}`/);
});
