import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const catalogPath = path.join(process.cwd(), "data", "generated", "locations.generated.json");
const contentExclusionsPath = path.join(process.cwd(), "data", "image-content-exclusions.json");
const outputDirectory = path.join(process.cwd(), "test-artifacts", "catalog-quality");
const categories = ["capitals", "cities", "landmarks", "landscapes"];
const samplesPerCategory = Math.max(1, Number.parseInt(process.env.CATALOG_SAMPLE_PER_CATEGORY ?? "6", 10));
const tileWidth = 480;
const tileHeight = 320;
const imageHeight = 270;

function strictEligible(location) {
  const width = location.imageWidth ?? 0;
  const height = location.imageHeight ?? 0;
  const year = location.imageCapturedAt ? new Date(location.imageCapturedAt).getUTCFullYear() : 0;
  const aspectRatio = width / Math.max(1, height);
  const categoryVerified = location.catalogVariant === "curated-image"
    ? location.imageReviewStatus === "approved" && (location.imageCategoryFitScore ?? 0) >= 8
    : Boolean(location.wikidataId && location.imageFile && (location.imageCategoryFitScore ?? 0) >= 8);
  return categoryVerified
    && year >= 2010
    && width >= 2560
    && height >= 1440
    && aspectRatio >= 1.25
    && aspectRatio <= 3
    && location.imageReviewStatus !== "quarantined";
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escaped(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character]);
}

function thumbnailUrl(location) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(location.imageFile)}?width=800`;
}

async function renderTile(location) {
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(thumbnailUrl(location), {
      headers: { "user-agent": "Punktlandung/1.0 (catalog visual audit; aintartstudio@gmail.com)" },
      signal: AbortSignal.timeout(15_000)
    });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 2) throw new Error(`HTTP ${response.status}`);
    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") ?? "2", 10);
    await new Promise((resolve) => setTimeout(resolve, Math.max(2, retryAfterSeconds) * 1000));
  }
  if (!response?.ok) throw new Error("No successful image response");
  const image = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(tileWidth, imageHeight, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  const year = new Date(location.imageCapturedAt).getUTCFullYear();
  const label = `${location.category.toUpperCase()} · ${year} · ${location.imageWidth}×${location.imageHeight}`;
  const title = location.title.length > 48 ? `${location.title.slice(0, 45)}…` : location.title;
  const caption = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight - imageHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#08111f"/>
    <text x="14" y="20" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="12" font-weight="700">${escaped(label)}</text>
    <text x="14" y="40" fill="#f8fafc" font-family="Arial, sans-serif" font-size="15" font-weight="700">${escaped(title)}</text>
  </svg>`);
  return sharp({
    create: { width: tileWidth, height: tileHeight, channels: 3, background: "#08111f" }
  }).composite([
    { input: image, left: 0, top: 0 },
    { input: caption, left: 0, top: imageHeight }
  ]).webp({ quality: 84 }).toBuffer();
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const contentExclusions = new Set(JSON.parse(await readFile(contentExclusionsPath, "utf8")));
const selected = categories.flatMap((category) => catalog
  .filter((location) => location.category === category && !contentExclusions.has(location.id) && strictEligible(location))
  .sort((first, second) => stableHash(first.id) - stableHash(second.id))
  .slice(0, samplesPerCategory));
const results = [];
const tiles = [];

for (const location of selected) {
  try {
    tiles.push(await renderTile(location));
    results.push({
      id: location.id,
      title: location.title,
      category: location.category,
      imageFile: location.imageFile,
      imageCapturedAt: location.imageCapturedAt,
      imageWidth: location.imageWidth,
      imageHeight: location.imageHeight,
      status: "rendered"
    });
  } catch (error) {
    results.push({ id: location.id, title: location.title, category: location.category, status: "failed", error: error instanceof Error ? error.message : String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, 220));
}

const columns = 3;
const rows = Math.ceil(tiles.length / columns);
const sheet = sharp({
  create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: "#020617" }
});
await mkdir(outputDirectory, { recursive: true });
await sheet.composite(tiles.map((input, index) => ({
  input,
  left: (index % columns) * tileWidth,
  top: Math.floor(index / columns) * tileHeight
}))).webp({ quality: 86 }).toFile(path.join(outputDirectory, "sample.webp"));
await writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(`Katalog-Stichprobe: ${tiles.length}/${selected.length} Bilder gerendert nach ${outputDirectory}`);
