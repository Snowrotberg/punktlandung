import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve(process.env.NEXT_DIST_DIR || ".next");
const manifest = JSON.parse(await readFile(path.join(distDir, "integrity-manifest.json"), "utf8"));
const mismatches = [];
for (const entry of manifest.files ?? []) {
  try {
    const bytes = await readFile(path.join(distDir, entry.path));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== entry.sha256) mismatches.push(entry.path);
  } catch { mismatches.push(entry.path); }
}
if (mismatches.length) {
  console.error(`Integrity verification failed for ${mismatches.length} file(s):\n${mismatches.slice(0, 20).join("\n")}`);
  process.exit(1);
}
console.log(`Integrity verification passed for ${manifest.files.length} files.`);
