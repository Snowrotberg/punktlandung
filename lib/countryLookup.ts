import type { LatLng } from "@/types/game";
import { haversineDistanceKm } from "./geo";

type Ring = number[][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

type CountryFeature = {
  code: string;
  polygons: MultiPolygon;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
};

type CountriesGeoJson = {
  features: Array<{
    properties: Record<string, string | undefined>;
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: Polygon | MultiPolygon;
    };
  }>;
};

let countryPromise: Promise<CountryFeature[]> | null = null;

function bboxFor(polygons: MultiPolygon) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
    }
  }

  return { minLat, maxLat, minLng, maxLng };
}

function normalizePolygons(geometry: CountriesGeoJson["features"][number]["geometry"]): MultiPolygon {
  return geometry.type === "Polygon" ? [geometry.coordinates as Polygon] : (geometry.coordinates as MultiPolygon);
}

async function loadCountries() {
  if (!countryPromise) {
    countryPromise = fetch("/countries.json")
      .then((response) => {
        if (!response.ok) throw new Error("countries.json konnte nicht geladen werden");
        return response.json() as Promise<CountriesGeoJson>;
      })
      .then((data) =>
        data.features
          .map((feature) => {
            const code = feature.properties["ISO3166-1-Alpha-2"];
            if (!code || code === "-99") return null;
            const polygons = normalizePolygons(feature.geometry);
            return { code, polygons, bbox: bboxFor(polygons) };
          })
          .filter((feature): feature is CountryFeature => Boolean(feature))
      );
  }

  return countryPromise;
}

function pointInRing(point: LatLng, ring: Ring) {
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: LatLng, polygon: Polygon) {
  if (!pointInRing(point, polygon[0])) return false;
  return polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

function pointInCountry(point: LatLng, country: CountryFeature) {
  return country.polygons.some((polygon) => pointInPolygon(point, polygon));
}

function paddedBboxContains(point: LatLng, country: CountryFeature, paddingDegrees: number) {
  return (
    point.lat >= country.bbox.minLat - paddingDegrees &&
    point.lat <= country.bbox.maxLat + paddingDegrees &&
    point.lng >= country.bbox.minLng - paddingDegrees &&
    point.lng <= country.bbox.maxLng + paddingDegrees
  );
}

function distanceToSegmentKm(point: LatLng, start: number[], end: number[]) {
  const midLat = ((start[1] + end[1] + point.lat) / 3) * (Math.PI / 180);
  const kmPerLng = 111.32 * Math.cos(midLat);
  const ax = start[0] * kmPerLng;
  const ay = start[1] * 110.57;
  const bx = end[0] * kmPerLng;
  const by = end[1] * 110.57;
  const px = point.lng * kmPerLng;
  const py = point.lat * 110.57;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const closest = { lat: (ay + t * dy) / 110.57, lng: (ax + t * dx) / kmPerLng };
  return haversineDistanceKm(point, closest);
}

function distanceToCountryKm(point: LatLng, country: CountryFeature) {
  let best = Number.POSITIVE_INFINITY;
  for (const polygon of country.polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i += 1) {
        best = Math.min(best, distanceToSegmentKm(point, ring[i - 1], ring[i]));
        if (best <= 35) return best;
      }
    }
  }
  return best;
}

export async function findCountryCodeAtPoint(point: LatLng): Promise<string | undefined> {
  const countries = await loadCountries();
  const bboxMatches = countries.filter((country) => paddedBboxContains(point, country, 0.4));
  const exact = bboxMatches.find((country) => pointInCountry(point, country));
  if (exact) return exact.code;

  const coastalMatch = bboxMatches
    .map((country) => ({ country, distanceKm: distanceToCountryKm(point, country) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  return coastalMatch && coastalMatch.distanceKm <= 35 ? coastalMatch.country.code : undefined;
}
