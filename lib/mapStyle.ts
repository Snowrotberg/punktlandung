export const PUNKTLANDUNG_MAP_STYLES = {
  mercator: {
    projection: "mercator",
    url: "/map-styles/punktlandung-maputnik-3.1-mercator-v13.json?v=punktlandung-maputnik-3.1-v13"
  },
  globe: {
    projection: "globe",
    url: "/map-styles/punktlandung-maputnik-3.1-globe-v13.json?v=punktlandung-maputnik-3.1-v13"
  }
} as const;

export type PunktlandungMapStyleVariant = keyof typeof PUNKTLANDUNG_MAP_STYLES;

export const PUNKTLANDUNG_HILLSHADE_SOURCE_ID = "hillshade_dem";
export const PUNKTLANDUNG_TERRAIN_SOURCE_ID = "terrain_dem";

export function punktlandungMapStyleUrl(variant: PunktlandungMapStyleVariant): string {
  return PUNKTLANDUNG_MAP_STYLES[variant].url;
}

/** Backwards-compatible gameplay default. Interactive guessing stays Mercator. */
export const PUNKTLANDUNG_MAP_STYLE_URL = punktlandungMapStyleUrl("mercator");
