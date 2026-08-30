import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/admin/page.module.css", import.meta.url), "utf8");

test("gameplay statistics keep count, separator and share in one compact value line", () => {
  assert.match(page, /<strong>\{row\.count\}<\/strong>[\s\S]*?<i aria-hidden="true">·<\/i>[\s\S]*?<small>\{row\.share\} % der Starts<\/small>/);
  assert.match(styles, /\.gameplayList li \{[^}]*flex-direction: column;[^}]*\}/);
  assert.match(styles, /\.gameplayMetric \{[^}]*display: inline-flex;[^}]*justify-content: flex-start;[^}]*white-space: nowrap;[^}]*\}/);
  assert.match(styles, /\.gameplayList \.gameplayMetric strong \{[^}]*font-size: 1rem;[^}]*\}/);
  assert.match(styles, /\.list strong \{ font-size: \.82rem; \}/);
  assert.ok(styles.indexOf(".gameplayList .gameplayMetric strong") < styles.indexOf(".list strong"));
});
