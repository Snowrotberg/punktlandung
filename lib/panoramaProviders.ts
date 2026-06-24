import type { GeoLocation, LatLng } from "../types/game";

type MapillaryImage = {
  id: string;
  thumb_original_url?: string;
  computed_geometry?: {
    coordinates?: [number, number];
  };
  is_pano?: boolean;
};

type MapillaryResponse = {
  data?: MapillaryImage[];
};

export function bboxAround(point: LatLng, radiusDegrees = 0.08): string {
  const west = Math.max(-180, point.lng - radiusDegrees);
  const south = Math.max(-85, point.lat - radiusDegrees);
  const east = Math.min(180, point.lng + radiusDegrees);
  const north = Math.min(85, point.lat + radiusDegrees);
  return [west, south, east, north].join(",");
}

export async function findMapillaryPanoramasNear(point: LatLng, accessToken: string): Promise<GeoLocation[]> {
  if (!accessToken.trim()) return [];
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,thumb_original_url,computed_geometry,is_pano",
    bbox: bboxAround(point),
    limit: "20"
  });
  const response = await fetch(`https://graph.mapillary.com/images?${params.toString()}`, {
    headers: { accept: "application/json" },
    cache: "force-cache"
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as MapillaryResponse;
  return (payload.data ?? [])
    .filter((image) => image.thumb_original_url && image.computed_geometry?.coordinates)
    .map((image) => {
      const [lng, lat] = image.computed_geometry?.coordinates ?? [point.lng, point.lat];
      return {
        id: `mapillary-${image.id}`,
        title: image.is_pano ? "Mapillary 360 Panorama" : "Mapillary Straßenbild",
        countryCode: "UN",
        countryName: "Unbekannt",
        continent: "Unknown",
        lat,
        lng,
        panoramaUrl: image.thumb_original_url ?? "",
        attribution: "Mapillary, CC BY-SA",
        source: "mapillary-ready",
        category: "streetview"
      };
    });
}

export function makeWikimediaLocation(input: Omit<GeoLocation, "source">): GeoLocation {
  return {
    ...input,
    source: "wikimedia"
  };
}
