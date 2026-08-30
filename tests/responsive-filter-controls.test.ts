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

test("shared mobile selectors use a mint outline with only a restrained active tint", async () => {
  const primitives = await read("components/redesign/RedesignPrimitives.module.css");
  const sharedStyles = await read("components/ResponsiveRouteSelect.module.css");
  assert.match(primitives, /--pl-choice-active-surface: color-mix\([^;]*8%/);
  assert.match(primitives, /--pl-choice-hover-surface: color-mix\([^;]*12%/);
  assert.match(primitives, /prefers-reduced-motion:[^)]+\)[\s\S]*--pl-choice-hover-transform: none/);
  assert.match(sharedStyles, /\.select summary \{[^}]*background:var\(--pl-choice-active-surface\)[^}]*border:1px solid var\(--pl-choice-active-border\)/);
  assert.match(sharedStyles, /a\[aria-current="page"\] \{[^}]*background:var\(--pl-choice-active-surface\)[^}]*border-color:var\(--pl-choice-active-border\)/);
  assert.doesNotMatch(sharedStyles, /background:#12382f/);
});

test("account and admin choice surfaces consume the same active, hover and focus tokens", async () => {
  const files = await Promise.all([
    read("components/SectionNavigation.module.css"),
    read("components/AccountMenu.module.css"),
    read("components/ProfileVisibilitySelect.module.css"),
    read("app/konto/dashboard.module.css"),
    read("app/rankings/page.module.css"),
    read("app/admin/page.module.css")
  ]);
  for (const styles of files) {
    assert.match(styles, /var\(--pl-choice-active-surface\)/);
    assert.match(styles, /var\(--pl-choice-hover-surface\)/);
    assert.match(styles, /var\(--pl-choice-focus-outline\)/);
  }
  assert.match(files[1], /\.logout:hover[^}]*var\(--pl-red/);
});

test("the account header flyout exposes the current account destination", async () => {
  const source = await read("components/AccountMenu.tsx");
  assert.match(source, /usePathname/);
  assert.match(source, /href="\/konto" aria-current=/);
  assert.match(source, /href="\/konto\/verlauf" aria-current=/);
  assert.match(source, /href="\/rankings" aria-current=/);
  assert.match(source, /href="\/konto\/einstellungen" aria-current=/);
  assert.match(source, /href="\/admin" aria-current=/);
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
