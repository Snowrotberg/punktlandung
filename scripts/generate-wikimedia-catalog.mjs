import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = "https://query.wikidata.org/sparql";
const outputPath = path.join(process.cwd(), "data", "generated", "locations.generated.json");
const targetPerCategory = Number.parseInt(process.env.CATALOG_TARGET_PER_CATEGORY ?? "300", 10);
const queryLimit = Math.max(80, Math.min(450, Number.parseInt(process.env.CATALOG_QUERY_LIMIT ?? String(targetPerCategory * 2), 10)));
const userAgent = process.env.WIKIDATA_USER_AGENT ?? "Punktlandung catalog generator/0.1 (local development; contact: local)";
const requestTimeoutMs = Number.parseInt(process.env.CATALOG_REQUEST_TIMEOUT_MS ?? "45000", 10);
const retryCount = Number.parseInt(process.env.CATALOG_RETRIES ?? "2", 10);
const selectedCategories = new Set(
  (process.env.CATALOG_CATEGORIES ?? process.argv.slice(2).join(","))
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean)
);
const catalogCountries = [
  "wd:Q30",
  "wd:Q183",
  "wd:Q142",
  "wd:Q145",
  "wd:Q38",
  "wd:Q29",
  "wd:Q45",
  "wd:Q55",
  "wd:Q31",
  "wd:Q39",
  "wd:Q40",
  "wd:Q213",
  "wd:Q36",
  "wd:Q34",
  "wd:Q20",
  "wd:Q35",
  "wd:Q33",
  "wd:Q189",
  "wd:Q41",
  "wd:Q43",
  "wd:Q159",
  "wd:Q212",
  "wd:Q148",
  "wd:Q17",
  "wd:Q668",
  "wd:Q884",
  "wd:Q869",
  "wd:Q881",
  "wd:Q252",
  "wd:Q833",
  "wd:Q334",
  "wd:Q928",
  "wd:Q408",
  "wd:Q664",
  "wd:Q16",
  "wd:Q96",
  "wd:Q155",
  "wd:Q414",
  "wd:Q298",
  "wd:Q419",
  "wd:Q739",
  "wd:Q258",
  "wd:Q79",
  "wd:Q1028",
  "wd:Q114",
  "wd:Q924",
  "wd:Q878",
  "wd:Q851",
  "wd:Q801",
  "wd:Q810"
];
const catalogCountryValues = catalogCountries.join(" ");

const categoryConfigs = [
  {
    category: "landmarks",
    target: targetPerCategory,
    batchedByCountry: true,
    batchLimit: 8,
    query: `
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?continentLabel ?coord ?image ?sitelinks WHERE {
  VALUES ?country { __COUNTRY__ }
  {
    VALUES ?class {
      wd:Q4989906
      wd:Q839954
      wd:Q23413
      wd:Q12518
      wd:Q12280
      wd:Q16560
      wd:Q11303
      wd:Q2977
    }
    ?item wdt:P31 ?class.
  }
  ?item wdt:P18 ?image;
        wdt:P625 ?coord;
        wdt:P17 ?country;
        wikibase:sitelinks ?sitelinks.
  ?country wdt:P297 ?countryCode.
  OPTIONAL { ?country wdt:P30 ?continent. }
  FILTER(?sitelinks >= 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY DESC(?sitelinks)
LIMIT __BATCH_LIMIT__
`
  },
  {
    category: "cities",
    target: targetPerCategory,
    batchedByCountry: true,
    batchLimit: 8,
    query: `
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?continentLabel ?coord ?image ?sitelinks WHERE {
  VALUES ?country { __COUNTRY__ }
  ?item wdt:P31 wd:Q515;
        wdt:P18 ?image;
        wdt:P625 ?coord;
        wdt:P17 ?country;
        wikibase:sitelinks ?sitelinks.
  ?country wdt:P297 ?countryCode.
  OPTIONAL { ?country wdt:P30 ?continent. }
  FILTER(?sitelinks >= 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY DESC(?sitelinks)
LIMIT __BATCH_LIMIT__
`
  },
  {
    category: "landscapes",
    target: targetPerCategory,
    batchedByCountry: true,
    batchLimit: 8,
    query: `
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?continentLabel ?coord ?image ?sitelinks WHERE {
  VALUES ?country { __COUNTRY__ }
  VALUES ?class {
    wd:Q46169
    wd:Q8502
    wd:Q34038
    wd:Q23397
    wd:Q8514
    wd:Q150784
    wd:Q8072
    wd:Q23442
    wd:Q473972
    wd:Q151279
  }
  ?item wdt:P31 ?class;
        wdt:P18 ?image;
        wdt:P625 ?coord;
        wdt:P17 ?country;
        wikibase:sitelinks ?sitelinks.
  ?country wdt:P297 ?countryCode.
  OPTIONAL { ?country wdt:P30 ?continent. }
  FILTER(?sitelinks >= 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY DESC(?sitelinks)
LIMIT __BATCH_LIMIT__
`
  },
  {
    category: "capitals",
    target: targetPerCategory,
    query: `
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?continentLabel ?coord ?image ?sitelinks WHERE {
  ?country wdt:P31 wd:Q6256;
           wdt:P36 ?item;
           wdt:P297 ?countryCode.
  ?item wdt:P18 ?image;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks.
  OPTIONAL { ?country wdt:P30 ?continent. }
  FILTER(?sitelinks >= 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${queryLimit}
`
  },
  {
    category: "flags",
    target: 250,
    query: `
SELECT ?item ?itemLabel ?countryLabel ?countryCode ?continentLabel ?coord ?image ?sitelinks WHERE {
  ?item wdt:P31 wd:Q6256;
        wdt:P41 ?image;
        wdt:P297 ?countryCode;
        wikibase:sitelinks ?sitelinks.
  OPTIONAL { ?item wdt:P36 ?capital. ?capital wdt:P625 ?capitalCoord. }
  OPTIONAL { ?item wdt:P625 ?countryCoord. }
  BIND(COALESCE(?capitalCoord, ?countryCoord) AS ?coord)
  OPTIONAL { ?item wdt:P30 ?continent. }
  FILTER(BOUND(?coord))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY ?itemLabel
LIMIT 260
`
  }
];

function value(binding, key) {
  return binding[key]?.value ?? "";
}

function slug(input) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePoint(point) {
  const match = /^Point\(([-0-9.]+) ([-0-9.]+)\)$/.exec(point);
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

function fileNameFromImageUrl(url) {
  const marker = "/Special:FilePath/";
  if (url.includes(marker)) return decodeURIComponent(url.split(marker).pop() ?? "");
  return decodeURIComponent(url.split("/").pop() ?? "").replace(/^File:/, "");
}

const excludedGeneratedImagePatterns = [
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

function isExcludedGeneratedImageFile(imageFile) {
  return excludedGeneratedImagePatterns.some((pattern) => pattern.test(imageFile));
}

function wikimediaFileUrl(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

function wikidataId(url) {
  return url.split("/").pop() ?? "";
}

function normalizeContinent(label) {
  const normalized = label.trim().toLowerCase();
  const map = new Map([
    ["europa", "Europe"],
    ["europe", "Europe"],
    ["asien", "Asia"],
    ["asia", "Asia"],
    ["afrika", "Africa"],
    ["africa", "Africa"],
    ["nordamerika", "North America"],
    ["north america", "North America"],
    ["suedamerika", "South America"],
    ["sudamerika", "South America"],
    ["südamerika", "South America"],
    ["south america", "South America"],
    ["ozeanien", "Oceania"],
    ["oceania", "Oceania"],
    ["australien", "Oceania"],
    ["antarctica", "Antarctica"],
    ["antarktika", "Antarctica"]
  ]);
  return map.get(normalized) ?? label.trim() ?? "World";
}

function difficultyFromSitelinks(sitelinks, category) {
  if (category === "flags") return "easy";
  if (sitelinks >= 90) return "easy";
  if (sitelinks >= 35) return "medium";
  return "hard";
}

function makeTitle(binding, category) {
  const itemLabel = value(binding, "itemLabel");
  const countryLabel = value(binding, "countryLabel") || itemLabel;
  if (category === "flags") return `Flagge von ${countryLabel}`;
  return itemLabel;
}

function makeLocation(binding, category) {
  const coords = parsePoint(value(binding, "coord"));
  const imageFile = fileNameFromImageUrl(value(binding, "image"));
  const countryCode = value(binding, "countryCode").toUpperCase();
  const title = makeTitle(binding, category);
  const itemId = wikidataId(value(binding, "item"));
  const sitelinks = Number(value(binding, "sitelinks")) || 0;

  if (!coords || !imageFile || !countryCode || !title || !itemId) return null;
  if (category !== "flags" && /\.(svg|gif)$/i.test(imageFile)) return null;
  if (isExcludedGeneratedImageFile(imageFile)) return null;

  return {
    id: `${category}-${slug(title || itemId)}-${itemId.toLowerCase()}`,
    title,
    countryCode,
    countryName: value(binding, "countryLabel") || countryCode,
    continent: normalizeContinent(value(binding, "continentLabel")),
    lat: Number(coords.lat.toFixed(5)),
    lng: Number(coords.lng.toFixed(5)),
    panoramaUrl: wikimediaFileUrl(imageFile),
    panoramaUrls: [wikimediaFileUrl(imageFile)],
    attribution: "Wikimedia Commons / Wikidata",
    source: "wikimedia",
    category,
    wikidataId: itemId,
    imageFile,
    difficulty: difficultyFromSitelinks(sitelinks, category),
    popularity: sitelinks
  };
}

async function fetchSparql(query) {
  const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
  let lastError;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/sparql-results+json",
          "user-agent": userAgent
        }
      });
      if (!response.ok) {
        throw new Error(`Wikidata returned ${response.status}: ${await response.text()}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= retryCount;
      if (isLastAttempt) break;
      const waitMs = 1200 * (attempt + 1);
      console.warn(`  retry ${attempt + 1}/${retryCount} after ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function run() {
  const allLocations = [];
  const seenIds = new Set();
  const seenImages = new Set();
  const configs = selectedCategories.size > 0 ? categoryConfigs.filter((config) => selectedCategories.has(config.category)) : categoryConfigs;

  for (const config of configs) {
    console.log(`Fetching ${config.category}...`);
    const locations = [];
    const queries = config.batchedByCountry
      ? catalogCountries.map((country) => ({
          label: country,
          query: config.query.replaceAll("__COUNTRY__", country).replaceAll("__BATCH_LIMIT__", String(config.batchLimit ?? 8))
        }))
      : [{ label: config.category, query: config.query }];

    for (const queryVariant of queries) {
      if (locations.length >= config.target) break;
      try {
        const data = await fetchSparql(queryVariant.query);
        for (const binding of data.results.bindings) {
          const location = makeLocation(binding, config.category);
          if (!location) continue;
          const imageKey = location.imageFile.toLowerCase();
          if (seenIds.has(location.id) || seenImages.has(`${location.category}:${imageKey}`)) continue;
          seenIds.add(location.id);
          seenImages.add(`${location.category}:${imageKey}`);
          locations.push(location);
          if (locations.length >= config.target) break;
        }
      } catch (error) {
        console.warn(`  skipped ${queryVariant.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    console.log(`  ${locations.length} accepted`);
    allLocations.push(...locations);
  }

  let outputLocations = allLocations;
  if (selectedCategories.size > 0) {
    try {
      const existing = JSON.parse(await readFile(outputPath, "utf8"));
      const existingLocations = Array.isArray(existing) ? existing : [];
      outputLocations = [
        ...existingLocations.filter((location) => !selectedCategories.has(location.category)),
        ...allLocations
      ];
    } catch {
      outputLocations = allLocations;
    }
  }

  outputLocations = outputLocations.filter((location) => {
    const imageFile = typeof location?.imageFile === "string" ? location.imageFile : "";
    return imageFile ? !isExcludedGeneratedImageFile(imageFile) : true;
  });

  outputLocations.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(outputLocations, null, 2)}\n`, "utf8");

  const counts = outputLocations.reduce((acc, location) => {
    acc[location.category] = (acc[location.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${outputLocations.length} locations to ${outputPath}`);
  console.log(counts);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
