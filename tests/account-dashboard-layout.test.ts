import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/konto/dashboard.module.css", import.meta.url), "utf8");

test("the account overview rows can grow with complete balance labels", () => {
  assert.match(styles, /\.overviewDashboard \{[^}]*grid-template-rows: repeat\(3, minmax\(8\.2rem, auto\)\);[^}]*\}/);
  assert.doesNotMatch(styles, /\.overviewDashboard \{[^}]*grid-template-rows: repeat\(3, 8\.2rem\);[^}]*\}/);
});
