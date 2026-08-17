import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = "https://commons.wikimedia.org/w/api.php";
const catalogPath = path.join(process.cwd(), "data", "generated", "locations.generated.json");
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "Punktlandung/1.0 (semantic catalog generator; aintartstudio@gmail.com)";
const concurrency = Math.max(1, Math.min(6, Number.parseInt(process.env.CATALOG_AUGMENT_CONCURRENCY ?? "4", 10)));
const targetPerCategory = Math.max(10, Number.parseInt(process.env.CATALOG_AUGMENT_TARGET_PER_CATEGORY ?? "100", 10));
const selectedCategories = new Set(
  (process.env.CATALOG_AUGMENT_CATEGORIES ?? "capitals,cities,landmarks,landscapes")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean)
);
const requestSpacingMs = Math.max(100, Number.parseInt(process.env.CATALOG_AUGMENT_REQUEST_SPACING_MS ?? "220", 10));
const refreshExistingMetadata = process.env.CATALOG_REFRESH_EXISTING_METADATA !== "false";
let nextRequestAt = 0;
const englishRegionNames = new Intl.DisplayNames(["en"], { type: "region" });
const categoryTargets = {
  capitals: targetPerCategory,
  cities: targetPerCategory,
  landmarks: targetPerCategory,
  landscapes: targetPerCategory
};

const categoryProfiles = {
  capitals: {
    queries: ["skyline OR cityscape OR panorama", "street OR square OR architecture"],
    positive: [/skyline/i, /cityscape/i, /panoram/i, /street/i, /avenue/i, /square/i, /plaza/i, /architecture/i, /downtown/i, /old town/i, /city view/i, /urban/i],
    required: [/skyline/i, /cityscape/i, /panoram/i, /street/i, /avenue/i, /square/i, /plaza/i, /architecture/i, /downtown/i, /old town/i, /city view/i, /urban/i, /building/i],
    minScore: 8
  },
  cities: {
    queries: ["skyline OR cityscape OR panorama", "street OR square OR architecture"],
    positive: [/skyline/i, /cityscape/i, /panoram/i, /street/i, /avenue/i, /square/i, /plaza/i, /architecture/i, /downtown/i, /old town/i, /city view/i, /urban/i],
    required: [/skyline/i, /cityscape/i, /panoram/i, /street/i, /avenue/i, /square/i, /plaza/i, /architecture/i, /downtown/i, /old town/i, /city view/i, /urban/i, /building/i],
    minScore: 8
  },
  landmarks: {
    queries: ["exterior OR view OR panorama", "architecture OR monument"],
    positive: [/exterior/i, /view/i, /panoram/i, /architecture/i, /monument/i, /facade/i, /building/i],
    required: [/exterior/i, /view/i, /panoram/i, /architecture/i, /monument/i, /facade/i, /building/i],
    minScore: 7
  },
  landscapes: {
    queries: ["landscape OR panorama OR scenic", "mountain OR coast OR lake OR valley OR waterfall"],
    positive: [/landscape/i, /panoram/i, /scenic/i, /mountain/i, /coast/i, /lake/i, /valley/i, /waterfall/i, /forest/i, /desert/i, /canyon/i, /nature/i, /national park/i],
    required: [/landscape/i, /panoram/i, /scenic/i, /mountain/i, /coast/i, /lake/i, /valley/i, /waterfall/i, /forest/i, /desert/i, /canyon/i, /nature/i, /national park/i],
    minScore: 7
  }
};

const rejectedContent = [
  /\b(person|people|portraits?|politicians?|presidents?|ministers?|secretaries|ambassadors?|weddings?|brides?|grooms?)\b/i,
  /\b(conference|meeting|protest|demonstration|ceremony|festival|concert|choir|crowd)\b/i,
  /\b(interiors?|inside|rooms?|offices?|gyms?|museums?|museum exhibit|waiting room|tombs?|porch|hotels?)\b/i,
  /\b(bird|animal|dog|cat|camel|deer|horse|livestock|food|drink|car|bus|train|aircraft|ship profile)\b/i,
  /\b(map|diagram|locator|collage|montage|logo|coat of arms|flag|poster|document)\b/i,
  /\b(aerial map|satellite|from space|nasa|landsat|sentinel|topographic)\b/i,
  /\b(selfie|headshot|close[- ]?up|grave|plaque|memorial tablet|signboard|reporters?|delegations?|nara)\b/i,
  /\b(armed|army|battle|combat|military|rifles?|soldiers?|troops?|weapons?)\b/i
];

const categoryRejectedContent = {
  capitals: [/\b(museum|gallery|pinakothek|campus|university|garden|park|exhibition|boardroom)\b/i],
  cities: [/\b(museum|gallery|pinakothek|campus|university|garden|exhibition|boardroom)\b/i],
  landmarks: [/\b(comparison|list of|tallest buildings|scale model)\b/i],
  landscapes: [/\b(book|journal|painting|illustration|engraving|historic print|postcard)\b/i]
};

function normalize(input) {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fileKey(fileName) {
  return normalize(fileName.replace(/^File:/i, ""));
}

function slug(input) {
  return normalize(input).replaceAll(" ", "-").slice(0, 48);
}

function metadataValue(metadata, key) {
  return String(metadata?.[key]?.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedDate(value) {
  const match = String(value ?? "").match(/\b(18|19|20)\d{2}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?/);
  if (!match) return undefined;
  const parsed = new Date(match[0].replaceAll("/", "-").length === 4 ? `${match[0]}-01-01` : match[0].replaceAll("/", "-"));
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function commonsQualityAssessment(metadata) {
  const assessments = normalize(`${metadataValue(metadata, "Assessments")} ${metadataValue(metadata, "Categories")}`);
  if (/featured picture|featured images?|featured photographs?/.test(assessments)) return "featured";
  if (/quality image|quality images|quality photographs?/.test(assessments)) return "quality";
  if (/valued image|valued images/.test(assessments)) return "valued";
  return undefined;
}

function technicalQualityScore(info) {
  const megapixels = ((info.width ?? 0) * (info.height ?? 0)) / 1_000_000;
  const resolutionBonus = Math.max(0, Math.min(3.5, Math.log2(Math.max(1, megapixels)) * 0.9));
  const metadata = info.extmetadata;
  const assessment = commonsQualityAssessment(metadata);
  const assessmentBonus = assessment === "featured" ? 6 : assessment === "quality" ? 4 : assessment === "valued" ? 2 : 0;
  const capturedAt = normalizedDate(metadataValue(metadata, "DateTimeOriginal") || metadataValue(metadata, "DateTime"));
  const year = capturedAt ? new Date(capturedAt).getUTCFullYear() : 0;
  const recencyBonus = year >= 2022 ? 2.5 : year >= 2017 ? 1.8 : year >= 2010 ? 1 : year >= 2000 ? 0.4 : 0;
  return resolutionBonus + assessmentBonus + recencyBonus;
}

function semanticText(page) {
  const info = page.imageinfo?.[0];
  const metadata = info?.extmetadata;
  return [
    page.title,
    metadataValue(metadata, "ObjectName"),
    metadataValue(metadata, "ImageDescription"),
    metadataValue(metadata, "Categories")
  ].join(" ");
}

function meaningfulTokens(input) {
  return normalize(input)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !["city", "stadt", "region", "massiv", "mount", "grosse", "grossen", "saint", "sankt", "the", "republic", "national"].includes(token)
    );
}

function countrySearchText(location) {
  const englishName = /^[A-Z]{2}$/i.test(location.countryCode ?? "") ? englishRegionNames.of(location.countryCode.toUpperCase()) : "";
  return `${location.countryName} ${englishName ?? ""}`.trim();
}

function candidateScore(page, location) {
  const profile = categoryProfiles[location.category];
  const info = page.imageinfo?.[0];
  const fileName = String(page.title ?? "").replace(/^File:/, "");
  if (!profile || !info || !fileName) return -Infinity;
  if (!/^image\/(jpeg|png|webp)$/i.test(info.mime ?? "")) return -Infinity;
  if ((info.width ?? 0) < 1600 || (info.height ?? 0) < 900) return -Infinity;
  const aspectRatio = (info.width ?? 0) / Math.max(1, info.height ?? 1);
  if (aspectRatio < 1.25 || aspectRatio > 3.4) return -Infinity;

  const rawText = semanticText(page);
  const text = normalize(rawText);
  const fileText = normalize(fileName);
  if (rejectedContent.some((pattern) => pattern.test(text))) return -Infinity;
  if ((categoryRejectedContent[location.category] ?? []).some((pattern) => pattern.test(text))) return -Infinity;
  if (!profile.required.some((pattern) => pattern.test(text))) return -Infinity;

  const titleTokens = meaningfulTokens(location.title);
  if (titleTokens.length === 0 || /^q\d+$/i.test(location.title)) return -Infinity;
  const requiredTitleHits = Math.max(1, Math.ceil(titleTokens.length / 2));
  const titleHitsInFile = titleTokens.filter((token) => fileText.includes(token)).length;
  if (titleHitsInFile < requiredTitleHits) return -Infinity;
  const countryHits = meaningfulTokens(countrySearchText(location)).filter((token) => text.includes(token)).length;
  if (countryHits === 0) return -Infinity;

  const metadata = info.extmetadata;
  const artist = metadataValue(metadata, "Artist") || metadataValue(metadata, "Credit");
  const license = metadataValue(metadata, "LicenseShortName") || metadataValue(metadata, "UsageTerms");
  if (!artist || !license) return -Infinity;

  const positiveHits = profile.positive.filter((pattern) => pattern.test(text)).length;
  const relevanceBonus = Math.max(0, 4 - Number(page.index ?? 4)) * 0.35;
  return titleHitsInFile * 5 + Math.min(2, countryHits) + positiveHits * 2 + Math.min(2, aspectRatio - 1.25) + relevanceBonus + technicalQualityScore(info);
}

async function searchImages(location, queryTerms) {
  const url = new URL(endpoint);
  const params = {
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "35",
    gsrsearch: `\"${location.title}\" ${countrySearchText(location)} ${queryTerms} filetype:bitmap`,
    prop: "imageinfo",
    iiprop: "url|size|mime|timestamp|extmetadata",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms|ObjectName|ImageDescription|Categories|Assessments|DateTimeOriginal|DateTime"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = Date.now();
    const waitMs = Math.max(0, nextRequestAt - now);
    nextRequestAt = Math.max(now, nextRequestAt) + requestSpacingMs;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": userAgent },
      signal: AbortSignal.timeout(20_000)
    });
    if (response.ok) {
      const payload = await response.json();
      return payload.query?.pages ?? [];
    }
    if (response.status !== 429 || attempt === 2) throw new Error(`Commons returned ${response.status}`);
    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") ?? "2", 10);
    await new Promise((resolve) => setTimeout(resolve, Math.max(2, retryAfterSeconds) * 1000));
  }
  return [];
}

async function enrichExistingMetadata(locations) {
  if (!refreshExistingMetadata) return locations;
  const candidates = locations.filter((location) => location.source === "wikimedia" && location.imageFile);
  const byFile = new Map();
  for (const location of candidates) {
    const key = fileKey(location.imageFile);
    byFile.set(key, [...(byFile.get(key) ?? []), location]);
  }
  const files = [...new Set(candidates.map((location) => location.imageFile))];
  let updated = 0;

  for (let offset = 0; offset < files.length; offset += 40) {
    const batch = files.slice(offset, offset + 40);
    const url = new URL(endpoint);
    const params = {
      action: "query",
      format: "json",
      formatversion: "2",
      titles: batch.map((fileName) => `File:${fileName}`).join("|"),
      prop: "imageinfo",
      iiprop: "size|mime|timestamp|extmetadata",
      iiextmetadatafilter: "Categories|Assessments|DateTimeOriginal|DateTime"
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const now = Date.now();
    const waitMs = Math.max(0, nextRequestAt - now);
    nextRequestAt = Math.max(now, nextRequestAt) + requestSpacingMs;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": userAgent },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`Commons metadata refresh returned ${response.status}`);
    const payload = await response.json();
    for (const page of payload.query?.pages ?? []) {
      const matchingLocations = byFile.get(fileKey(String(page.title ?? ""))) ?? [];
      const info = page.imageinfo?.[0];
      if (matchingLocations.length === 0 || !info) continue;
      const metadata = info.extmetadata;
      for (const location of matchingLocations) {
        location.imageWidth = info.width;
        location.imageHeight = info.height;
        location.imageCapturedAt = normalizedDate(metadataValue(metadata, "DateTimeOriginal") || metadataValue(metadata, "DateTime"));
        location.imageUploadedAt = normalizedDate(info.timestamp);
        location.commonsQualityAssessment = commonsQualityAssessment(metadata);
        updated += 1;
      }
    }
  }
  console.log(`Commons-Metadaten aktualisiert: ${updated}/${candidates.length} Bilder.`);
  return locations;
}

async function bestImage(location, seenImages) {
  const profile = categoryProfiles[location.category];
  if (!profile) return null;
  const candidates = [];
  for (const query of profile.queries) {
    const pages = await searchImages(location, query);
    candidates.push(...pages);
    if (candidates.some((page) => candidateScore(page, location) >= profile.minScore)) break;
  }
  return candidates
    .filter((page) => !seenImages.has(fileKey(String(page.title ?? ""))))
    .map((page) => ({ page, score: candidateScore(page, location) }))
    .filter((candidate) => candidate.score >= profile.minScore)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

async function run() {
  const existing = JSON.parse(await readFile(catalogPath, "utf8"));
  await enrichExistingMetadata(existing);
  const baseLocations = existing.filter((location) => !location.catalogVariant);
  const seenImages = new Set(existing.map((location) => fileKey(location.imageFile ?? location.panoramaUrl)));
  const enabledCategories = Object.keys(categoryTargets).filter((category) => selectedCategories.has(category));
  const candidates = enabledCategories.flatMap((category) =>
    baseLocations
      .filter((location) => location.category === category)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  );
  const acceptedCounts = Object.fromEntries(enabledCategories.map((category) => [
    category,
    existing.filter((location) => location.category === category && location.catalogVariant === "curated-image").length
  ]));
  const variants = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const location = candidates[cursor++];
      if (acceptedCounts[location.category] >= categoryTargets[location.category]) continue;
      try {
        const candidate = await bestImage(location, seenImages);
        if (!candidate || acceptedCounts[location.category] >= categoryTargets[location.category]) continue;
        const fileName = candidate.page.title.replace(/^File:/, "");
        seenImages.add(fileKey(fileName));
        acceptedCounts[location.category] += 1;
        const panoramaUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
        const info = candidate.page.imageinfo?.[0];
        const metadata = info?.extmetadata;
        variants.push({
          ...location,
          id: `${location.id}-curated-${slug(fileName)}`,
          panoramaUrl,
          panoramaUrls: [panoramaUrl],
          imageFile: fileName,
          catalogVariant: "curated-image",
          imageQualityScore: Number(candidate.score.toFixed(2)),
          imageReviewStatus: "approved",
          imageWidth: info?.width,
          imageHeight: info?.height,
          imageCapturedAt: normalizedDate(metadataValue(metadata, "DateTimeOriginal") || metadataValue(metadata, "DateTime")),
          imageUploadedAt: normalizedDate(info?.timestamp),
          commonsQualityAssessment: commonsQualityAssessment(metadata)
        });
      } catch (error) {
        console.warn(`Skipped ${location.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (cursor % 50 === 0) console.log(`Semantisch geprüft: ${cursor}/${candidates.length}`, acceptedCounts);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const output = [...existing, ...variants].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
  await writeFile(catalogPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Katalog ergänzt: ${existing.length} bestehende Aufgaben + ${variants.length} neue semantisch geprüfte Varianten = ${output.length}`);
  console.log(acceptedCounts);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
