import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = "https://commons.wikimedia.org/w/api.php";
const catalogPath = path.join(process.cwd(), "data", "generated", "locations.generated.json");
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "Punktlandung/1.0 (catalog generator; aintartstudio@gmail.com)";
const concurrency = Math.max(1, Math.min(8, Number.parseInt(process.env.CATALOG_AUGMENT_CONCURRENCY ?? "5", 10)));
const categoryTargets = {
  capitals: 150,
  cities: 180,
  landmarks: 130,
  landscapes: 140
};
const searchRadius = {
  capitals: 2500,
  cities: 3000,
  landmarks: 750,
  landscapes: 8000
};
const excludedImagePatterns = [
  /\baerial map\b/i,
  /\bcia map\b/i,
  /\bcollage\b/i,
  /\bcloudless\b/i,
  /\bdiagram\b/i,
  /\bkarte\b/i,
  /\blandsat\b/i,
  /\blocator\b/i,
  /\bmap\b/i,
  /\bmodel\b/i,
  /\bmontage\b/i,
  /\bnasa\b/i,
  /\bphoto[\s-]?montage\b/i,
  /\brelief map\b/i,
  /\bsatellite\b/i,
  /\bsentinel\b/i,
  /\btopo\b/i
];

function fileKey(fileName) {
  return fileName.replace(/^File:/i, "").replaceAll("_", " ").normalize("NFC").trim().toLocaleLowerCase();
}

function slug(input) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function metadataValue(metadata, key) {
  return String(metadata?.[key]?.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isSuitableImage(page, seenImages) {
  const info = page.imageinfo?.[0];
  const fileName = String(page.title ?? "").replace(/^File:/, "");
  if (!info || !fileName || seenImages.has(fileKey(fileName))) return false;
  if (!/^image\/(jpeg|png|webp)$/i.test(info.mime ?? "")) return false;
  if ((info.width ?? 0) < 1600 || (info.height ?? 0) < 900) return false;
  if ((info.width ?? 0) / Math.max(1, info.height ?? 1) < 1.2) return false;
  if (excludedImagePatterns.some((pattern) => pattern.test(fileName))) return false;
  const metadata = info.extmetadata;
  const artist = metadataValue(metadata, "Artist") || metadataValue(metadata, "Credit");
  const license = metadataValue(metadata, "LicenseShortName") || metadataValue(metadata, "UsageTerms");
  return Boolean(artist && license);
}

async function nearbyImages(location) {
  const url = new URL(endpoint);
  const params = {
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "geosearch",
    ggsprimary: "all",
    ggsnamespace: "6",
    ggsradius: String(searchRadius[location.category] ?? 1000),
    ggscoord: `${location.lat}|${location.lng}`,
    ggslimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": userAgent },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Commons returned ${response.status}`);
  const payload = await response.json();
  return payload.query?.pages ?? [];
}

async function run() {
  const existing = JSON.parse(await readFile(catalogPath, "utf8"));
  const baseLocations = existing.filter((location) => location.catalogVariant !== "nearby-image");
  const seenImages = new Set(baseLocations.map((location) => fileKey(location.imageFile ?? location.panoramaUrl)));
  const candidates = Object.entries(categoryTargets).flatMap(([category, target]) =>
    baseLocations
      .filter((location) => location.category === category)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, target)
  );
  const variants = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const location = candidates[cursor++];
      try {
        const pages = await nearbyImages(location);
        const page = pages.find((candidate) => isSuitableImage(candidate, seenImages));
        if (!page) continue;
        const fileName = page.title.replace(/^File:/, "");
        seenImages.add(fileKey(fileName));
        const panoramaUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
        variants.push({
          ...location,
          id: `${location.id}-image-${slug(fileName)}`,
          panoramaUrl,
          panoramaUrls: [panoramaUrl],
          imageFile: fileName,
          catalogVariant: "nearby-image"
        });
      } catch (error) {
        console.warn(`Skipped ${location.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (cursor % 50 === 0) console.log(`Commons-Bilder geprüft: ${cursor}/${candidates.length}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const output = [...baseLocations, ...variants].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
  await writeFile(catalogPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  const counts = variants.reduce((acc, location) => {
    acc[location.category] = (acc[location.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Katalog erweitert: ${baseLocations.length} Basisorte + ${variants.length} zusätzliche Bilder = ${output.length}`);
  console.log(counts);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
