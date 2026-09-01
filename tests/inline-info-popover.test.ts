import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("inline account help escapes scroll containers and stays inside the viewport", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../components/InlineInfoPopover.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/InlineInfoPopover.module.css", import.meta.url), "utf8")
  ]);

  assert.match(component, /createPortal\([\s\S]*document\.body/);
  assert.match(component, /window\.addEventListener\("scroll", placePanel, true\)/);
  assert.match(component, /panelRef\.current\?\.contains\(target\)/);
  assert.match(styles, /\.panel\s*\{[\s\S]*position:\s*fixed;[\s\S]*z-index:\s*400;/);
  assert.match(styles, /@media \(max-width: 36rem\)[\s\S]*bottom:\s*max\(1rem, env\(safe-area-inset-bottom\)\)/);
});
