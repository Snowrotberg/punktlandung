import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve(process.env.NEXT_DIST_DIR || ".next");
const roots = ["static", "server/app", "server/chunks"];
const entries = [];

async function walk(relativeDirectory) {
  const absoluteDirectory = path.join(distDir, relativeDirectory);
  let children;
  try { children = await readdir(absoluteDirectory, { withFileTypes: true }); } catch { return; }
  for (const child of children) {
    const relative = path.posix.join(relativeDirectory.replaceAll("\\", "/"), child.name);
    if (child.isDirectory()) await walk(relative);
    else if (child.isFile()) {
      const bytes = await readFile(path.join(distDir, relative));
      entries.push({ path: relative, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
}

for (const root of roots) await walk(root);
entries.sort((a, b) => a.path.localeCompare(b.path));
await mkdir(distDir, { recursive: true });
await writeFile(path.join(distDir, "integrity-manifest.json"), `${JSON.stringify({ release: process.env.PUNKTLANDUNG_RELEASE || null, generatedAt: new Date().toISOString(), files: entries }, null, 2)}\n`);
console.log(`Integrity manifest written for ${entries.length} files.`);
