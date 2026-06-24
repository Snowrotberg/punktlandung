import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const locationsPath = path.join(repoRoot, "data", "generated", "locations.generated.json");
const outputPath = path.join(repoRoot, "data", "generated", "location-boundaries.generated.json");

const TARGET_CATEGORIES = new Set(["cities", "capitals"]);
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const args = new Set(process.argv.slice(2));
const shouldFetchOsm = args.has("--fetch-osm");
const shouldRefresh = args.has("--refresh");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const maxFetchCount = limitArg ? Number(limitArg.replace("--limit=", "")) : Infinity;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCoord(value) {
  return Number(value.toFixed(6));
}

function fallbackRadiusKmFor(location) {
  const categoryBase = location.category === "capitals" ? 12 : 7;
  const popularity = clampNumber(location.popularity, 0);
  const difficultyBoost = location.difficulty === "hard" ? 3 : location.difficulty === "medium" ? 1.5 : 0;
  const popularityBoost = Math.min(6, popularity / 25);
  return Number((categoryBase + difficultyBoost + popularityBoost).toFixed(2));
}

function normalizeExistingBoundary(entry) {
  if (!entry || !Array.isArray(entry.polygons)) return null;
  return {
    ...entry,
    polygonSource: entry.polygonSource ?? null,
    polygons: entry.polygons,
    fallbackRadiusKm: clampNumber(entry.fallbackRadiusKm, 0)
  };
}

async function readExistingBoundaries() {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.boundaries)) return new Map();
    return new Map(
      parsed.boundaries
        .map(normalizeExistingBoundary)
        .filter(Boolean)
        .map((entry) => [entry.locationId, entry])
    );
  } catch {
    return new Map();
  }
}

function baseBoundaryEntry(location, existing) {
  return {
    boundaryKey: location.wikidataId || location.id,
    locationId: location.id,
    wikidataId: location.wikidataId || null,
    category: location.category,
    title: location.title,
    countryCode: location.countryCode,
    center: {
      lat: clampNumber(location.lat, 0),
      lng: clampNumber(location.lng, 0)
    },
    polygonSource: existing?.polygonSource ?? null,
    polygonStatus: existing?.polygonStatus ?? "fallback",
    osmRelationId: existing?.osmRelationId ?? null,
    osmAdminLevel: existing?.osmAdminLevel ?? null,
    osmName: existing?.osmName ?? null,
    polygons: Array.isArray(existing?.polygons) ? existing.polygons : [],
    fallbackRadiusKm: fallbackRadiusKmFor(location)
  };
}

function escapeOverpassString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function queryByWikidata(location) {
  if (!location.wikidataId) return null;
  const wikidataId = escapeOverpassString(location.wikidataId);
  return `[out:json][timeout:45];
(
  relation["boundary"="administrative"]["wikidata"="${wikidataId}"];
  relation["type"="boundary"]["wikidata"="${wikidataId}"];
)->.boundary;
.boundary out body;
way(r.boundary);
out geom;`;
}

function queryByName(location) {
  const name = escapeOverpassString(location.title);
  const countryCode = escapeOverpassString(location.countryCode);
  return `[out:json][timeout:45];
area["ISO3166-1"="${countryCode}"][admin_level=2]->.country;
(
  relation(area.country)["boundary"="administrative"]["name"="${name}"];
  relation(area.country)["boundary"="administrative"]["name:de"="${name}"];
  relation(area.country)["boundary"="administrative"]["int_name"="${name}"];
)->.boundary;
.boundary out body;
way(r.boundary);
out geom;`;
}

async function postOverpass(query, endpointIndex = 0) {
  const endpoint = OVERPASS_ENDPOINTS[endpointIndex] ?? OVERPASS_ENDPOINTS[0];
  const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
    headers: {
      accept: "application/json",
      "user-agent": "Punktlandung boundary importer (local development)"
    }
  });
  const text = await response.text();
  const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();

  if (!response.ok) {
    throw new Error(`Overpass ${response.status} ${response.statusText}${snippet ? `: ${snippet}` : ""}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Overpass lieferte kein JSON${snippet ? `: ${snippet}` : ""}`);
  }
}

async function fetchOverpass(query) {
  let lastError = null;
  for (let endpointIndex = 0; endpointIndex < OVERPASS_ENDPOINTS.length; endpointIndex += 1) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await postOverpass(query, endpointIndex);
      } catch (error) {
        lastError = error;
        await sleep(700 * attempt);
      }
    }
  }
  throw lastError;
}

function pointKey(point) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function pointsEqual(a, b) {
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

function toLatLng(point) {
  return {
    lat: roundCoord(clampNumber(point.lat, 0)),
    lng: roundCoord(clampNumber(point.lon ?? point.lng, 0))
  };
}

function closeRing(ring) {
  if (ring.length < 3) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  return pointsEqual(first, last) ? ring : [...ring, first];
}

function ringArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area += current.lng * next.lat - next.lng * current.lat;
  }
  return Math.abs(area / 2);
}

function simplifyRing(ring, maxPoints = 900) {
  if (ring.length <= maxPoints) return closeRing(ring);
  const step = Math.ceil(ring.length / maxPoints);
  const sampled = ring.filter((_, index) => index % step === 0);
  return closeRing(sampled);
}

function stitchSegments(segments) {
  const remaining = segments
    .map((segment) => segment.filter(Boolean))
    .filter((segment) => segment.length >= 2);
  const rings = [];

  while (remaining.length && rings.length < 12) {
    let ring = remaining.shift();
    let changed = true;

    while (changed && !pointsEqual(ring[0], ring[ring.length - 1])) {
      changed = false;
      const start = ring[0];
      const end = ring[ring.length - 1];

      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const candidateStart = candidate[0];
        const candidateEnd = candidate[candidate.length - 1];

        if (pointsEqual(end, candidateStart)) {
          ring = [...ring, ...candidate.slice(1)];
        } else if (pointsEqual(end, candidateEnd)) {
          ring = [...ring, ...candidate.slice(0, -1).reverse()];
        } else if (pointsEqual(start, candidateEnd)) {
          ring = [...candidate.slice(0, -1), ...ring];
        } else if (pointsEqual(start, candidateStart)) {
          ring = [...candidate.slice(1).reverse(), ...ring];
        } else {
          continue;
        }

        remaining.splice(index, 1);
        changed = true;
        break;
      }
    }

    const closed = closeRing(ring);
    if (closed.length >= 4 && pointsEqual(closed[0], closed[closed.length - 1])) {
      rings.push(closed);
    }
  }

  return rings
    .sort((a, b) => ringArea(b) - ringArea(a))
    .slice(0, 8)
    .map((ring) => simplifyRing(ring));
}

function relationScore(element, location) {
  const tags = element.tags ?? {};
  const adminLevel = Number(tags.admin_level);
  const adminScore = Number.isFinite(adminLevel) ? Math.max(0, 14 - Math.abs(8 - adminLevel) * 2) : 0;
  const exactName =
    tags.name === location.title ||
    tags["name:de"] === location.title ||
    tags.int_name === location.title ||
    tags.wikidata === location.wikidataId;
  const typeScore = tags.boundary === "administrative" ? 20 : tags.place ? 5 : 0;
  const wikidataScore = tags.wikidata && tags.wikidata === location.wikidataId ? 60 : 0;
  return typeScore + adminScore + (exactName ? 25 : 0) + wikidataScore;
}

function extractBoundaryFromOverpass(data, location) {
  const elements = data.elements ?? [];
  const waysById = new Map(
    elements
      .filter((element) => element.type === "way" && Array.isArray(element.geometry))
      .map((element) => [element.id, element.geometry.map(toLatLng)])
  );
  const relations = elements
    .filter((element) => element.type === "relation")
    .filter((element) => Array.isArray(element.members))
    .sort((a, b) => relationScore(b, location) - relationScore(a, location));

  for (const relation of relations) {
    const segments = relation.members
      .filter((member) => member.type === "way" && member.role !== "inner")
      .map((member) => {
        if (Array.isArray(member.geometry)) return member.geometry.map(toLatLng);
        return waysById.get(member.ref);
      })
      .filter((segment) => Array.isArray(segment) && segment.length >= 2);
    const polygons = stitchSegments(segments);
    if (polygons.length) {
      return {
        polygons,
        relation
      };
    }
  }

  return null;
}

async function fetchBoundaryForLocation(location) {
  const queries = [queryByWikidata(location), queryByName(location)].filter(Boolean);

  for (const query of queries) {
    const data = await fetchOverpass(query);
    const result = extractBoundaryFromOverpass(data, location);
    if (result) return result;
    await sleep(250);
  }

  return null;
}

function withFetchedBoundary(entry, result) {
  if (!result) {
    return {
      ...entry,
      polygonSource: null,
      polygonStatus: "fallback",
      osmRelationId: null,
      osmAdminLevel: null,
      osmName: null,
      polygons: []
    };
  }

  const tags = result.relation.tags ?? {};
  return {
    ...entry,
    polygonSource: "overpass",
    polygonStatus: "polygon",
    osmRelationId: result.relation.id ?? null,
    osmAdminLevel: tags.admin_level ?? null,
    osmName: tags.name ?? tags["name:de"] ?? tags.int_name ?? null,
    polygons: result.polygons
  };
}

async function main() {
  const raw = await fs.readFile(locationsPath, "utf8");
  const locations = JSON.parse(raw);
  if (!Array.isArray(locations)) {
    throw new Error("locations.generated.json ist kein Array.");
  }

  const existingByLocationId = await readExistingBoundaries();
  let fetchedCount = 0;
  let polygonCount = 0;

  const boundaries = [];
  for (const location of locations.filter((item) => item && TARGET_CATEGORIES.has(item.category))) {
    const existing = existingByLocationId.get(location.id);
    let entry = baseBoundaryEntry(location, existing);
    const hasCachedPolygon = entry.polygons.length > 0 && entry.polygonSource;

    if (shouldFetchOsm && (!hasCachedPolygon || shouldRefresh) && fetchedCount < maxFetchCount) {
      fetchedCount += 1;
      process.stdout.write(`OSM-Grenze ${fetchedCount}: ${location.title} (${location.countryCode}) ... `);
      try {
        const result = await fetchBoundaryForLocation(location);
        entry = withFetchedBoundary(entry, result);
        console.log(result ? `${entry.polygons.length} Polygon(e)` : "Fallback");
      } catch (error) {
        entry = { ...entry, polygonStatus: "fetch-error", polygonError: String(error?.message ?? error) };
        console.log(`Fehler, Fallback (${entry.polygonError})`);
      }
      await sleep(850);
    }

    if (entry.polygons.length > 0) polygonCount += 1;
    boundaries.push(entry);
  }

  boundaries.sort((a, b) => a.locationId.localeCompare(b.locationId, "de"));

  const payload = {
    generatedAt: new Date().toISOString(),
    version: 2,
    source: shouldFetchOsm ? "locations.generated.json + Overpass/OSM" : "locations.generated.json",
    fetchMode: shouldFetchOsm ? "osm" : "fallback-only",
    polygonCount,
    fallbackCount: boundaries.length - polygonCount,
    boundaries
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `location-boundaries.generated.json erzeugt: ${boundaries.length} Eintraege, ${polygonCount} mit Polygonen, ${boundaries.length - polygonCount} Fallback`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
