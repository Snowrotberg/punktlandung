import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("the shared mobile header owns the canonical safe-area-aware edge inset", async () => {
  const source = await readSource("../components/redesign/RedesignPrimitives.module.css");

  assert.match(source, /@media \(max-width: 52rem\)[\s\S]*?\.shell > \.header/);
  assert.match(source, /padding-left: max\(1rem, env\(safe-area-inset-left\)\)/);
  assert.match(source, /padding-right: max\(1rem, env\(safe-area-inset-right\)\)/);
});

test("the shared shell owns a full-width content raster outside the header no-go zone", async () => {
  const [shared, home] = await Promise.all([
    readSource("../components/redesign/RedesignPrimitives.module.css"),
    readSource("../components/redesign/RedesignHomeView.module.css")
  ]);

  assert.match(shared, /\.shell\s*\{[\s\S]*?linear-gradient\(90deg,[\s\S]*?background-repeat:\s*no-repeat, no-repeat, repeat;/);
  assert.match(shared, /\.shell::before\s*\{[\s\S]*?top:\s*var\(--pl-horizontal-grid-start\);[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?left:\s*0;/);
  assert.match(shared, /\.shell::before\s*\{[\s\S]*?background-repeat:\s*repeat-y;[\s\S]*?background-size:\s*100% var\(--pl-grid-size\);/);
  assert.match(shared, /@media \(max-width: 30rem\)[\s\S]*?--pl-header-height:\s*4rem;[\s\S]*?--pl-horizontal-grid-start:\s*var\(--pl-header-height\);/);
  assert.match(shared, /@media \(orientation: landscape\)[\s\S]*?--pl-header-height:\s*4rem;[\s\S]*?--pl-horizontal-grid-start:\s*var\(--pl-header-height\);/);
  assert.match(shared, /@media \(orientation: landscape\)[\s\S]*?\.shell > \.header \.button\s*\{[\s\S]*?min-height:\s*2\.5rem;[\s\S]*?padding-block:\s*\.5rem;/);
  assert.doesNotMatch(home, /background-position:\s*0 0, 0 0, 0 0, 0 4rem;/);
});

test("account, detail and community headers do not override the shared horizontal padding", async () => {
  const [account, detail, community] = await Promise.all([
    readSource("../app/konto/dashboard.module.css"),
    readSource("../app/konto/verlauf/[gameId]/page.module.css"),
    readSource("../app/community/page.module.css")
  ]);

  assert.doesNotMatch(account, /\.(?:topbar|subpageTop)\s*\{[^}]*padding(?:-inline|-left|-right)?\s*:/);
  assert.doesNotMatch(detail, /\.topbar\s*\{[^}]*padding(?:-inline|-left|-right)?\s*:/);
  assert.doesNotMatch(community, /\.header\s*\{[^}]*padding(?:-inline|-left|-right)?\s*:/);
});

test("all account-facing routes keep using the shared header primitive", async () => {
  const sources = await Promise.all([
    "../app/konto/page.tsx",
    "../app/konto/verlauf/page.tsx",
    "../app/konto/verlauf/[gameId]/page.tsx",
    "../app/konto/einstellungen/page.tsx",
    "../app/rankings/page.tsx",
    "../app/admin/page.tsx"
  ].map(readSource));

  for (const source of sources) {
    assert.match(source, /<RedesignHeader className=\{(?:styles|layoutStyles)\.(?:topbar|subpageTop)\}>/);
  }
});
