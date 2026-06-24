import boundariesData from "../data/generated/location-boundaries.generated.json";
import { badgeFor, haversineDistanceKm, scoreDistance } from "./geo";
import type { GeoLocation, Guess, LatLng, LocationCategory } from "../types/game";

type PolygonRing = LatLng[];

type BoundaryRecord = {
  boundaryKey: string;
  locationId: string;
  wikidataId: string | null;
  category: "cities" | "capitals";
  title: string;
  countryCode: string;
  center: LatLng;
  polygonSource: string | null;
  polygonStatus?: "polygon" | "fallback" | "fetch-error" | string;
  osmRelationId?: number | null;
  osmAdminLevel?: string | number | null;
  osmName?: string | null;
  polygonError?: string;
  polygons: PolygonRing[];
  fallbackRadiusKm: number;
};

type BoundaryPayload = {
  generatedAt: string;
  version: number;
  boundaries: BoundaryRecord[];
};

type TerritoryMatch = {
  isTerritoryCategory: boolean;
  isTerritoryHit: boolean;
  usedFallbackRadius: boolean;
  distanceKm: number;
  points: number;
  badge: string;
};

const payload = boundariesData as BoundaryPayload;
const boundaryByLocationId = new Map(payload.boundaries.map((entry) => [entry.locationId, entry]));
const territoryCategories = new Set<LocationCategory>(["cities", "capitals"]);

function isTerritoryCategory(category: LocationCategory): category is BoundaryRecord["category"] {
  return category === "cities" || category === "capitals";
}

function isPointInsideRing(point: LatLng, ring: PolygonRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.lng ?? 0;
    const yi = ring[i]?.lat ?? 0;
    const xj = ring[j]?.lng ?? 0;
    const yj = ring[j]?.lat ?? 0;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInsideRingBounds(point: LatLng, ring: PolygonRing): boolean {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const coord of ring) {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLng = Math.min(minLng, coord.lng);
    maxLng = Math.max(maxLng, coord.lng);
  }

  return point.lat >= minLat && point.lat <= maxLat && point.lng >= minLng && point.lng <= maxLng;
}

function isPointInBoundaryPolygons(point: LatLng, boundary: BoundaryRecord): boolean {
  if (!boundary.polygons.length) return false;
  return boundary.polygons.some(
    (ring) => ring.length >= 4 && isPointInsideRingBounds(point, ring) && isPointInsideRing(point, ring)
  );
}

function territoryBadge(category: "cities" | "capitals"): string {
  return category === "capitals" ? "Richtige Hauptstadt" : "Richtige Stadt";
}

export function evaluateTerritoryGuess(location: GeoLocation, guess: Guess | LatLng): TerritoryMatch | null {
  if (!territoryCategories.has(location.category) || !isTerritoryCategory(location.category)) return null;

  const boundary = boundaryByLocationId.get(location.id);
  const distanceKm = haversineDistanceKm(guess, location);
  const polygonHit = boundary ? isPointInBoundaryPolygons(guess, boundary) : false;
  const fallbackRadiusKm = boundary?.fallbackRadiusKm ?? (location.category === "capitals" ? 12 : 7);
  const fallbackHit = !polygonHit && distanceKm <= fallbackRadiusKm;
  const isHit = polygonHit || fallbackHit;

  if (isHit) {
    return {
      isTerritoryCategory: true,
      isTerritoryHit: true,
      usedFallbackRadius: !polygonHit,
      distanceKm: 0,
      points: 5000,
      badge: territoryBadge(location.category)
    };
  }

  return {
    isTerritoryCategory: true,
    isTerritoryHit: false,
    usedFallbackRadius: false,
    distanceKm,
    points: scoreDistance(distanceKm),
    badge: badgeFor(distanceKm, true)
  };
}

export function hasBoundaryCoverage(locationId: string): boolean {
  const boundary = boundaryByLocationId.get(locationId);
  return Boolean(boundary?.polygons.some((ring) => ring.length >= 4));
}
