import type { Guess, LatLng, RoundResult } from "../types/game";

const EARTH_RADIUS_KM = 6371;

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function shortestLongitudeDelta(aLng: number, bLng: number): number {
  return ((((bLng - aLng + 180) % 360) + 360) % 360) - 180;
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(shortestLongitudeDelta(a.lng, b.lng));
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function scoreDistance(distanceKm: number): number {
  const decay = Math.exp(-distanceKm / 1850);
  return Math.max(0, Math.round(5000 * decay));
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000)).toLocaleString("de-DE")} m`;
  }

  return `${Math.round(distanceKm).toLocaleString("de-DE")} km`;
}

export function averageGuess(guesses: Guess[]): LatLng | null {
  if (guesses.length === 0) return null;
  const total = guesses.reduce(
    (acc, guess) => {
      const lat = toRadians(guess.lat);
      const lng = toRadians(guess.lng);
      const cosLat = Math.cos(lat);
      return {
        x: acc.x + cosLat * Math.cos(lng),
        y: acc.y + cosLat * Math.sin(lng),
        z: acc.z + Math.sin(lat)
      };
    },
    { x: 0, y: 0, z: 0 }
  );
  const length = Math.hypot(total.x, total.y, total.z);
  if (length < Number.EPSILON) {
    const totalFallback = guesses.reduce(
      (acc, guess) => ({ lat: acc.lat + guess.lat, lng: acc.lng + guess.lng }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: totalFallback.lat / guesses.length,
      lng: totalFallback.lng / guesses.length
    };
  }
  const x = total.x / length;
  const y = total.y / length;
  const z = total.z / length;
  return {
    lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI
  };
}

const rankingTitles = [
  "Globus-Gott",
  "Pin-Papst",
  "Koordinaten-Kaiser",
  "Kompasskönig",
  "Atlasmeister",
  "Spurensucher",
  "Wegweiser",
  "Kartenkenner",
  "Abzweigprofi",
  "Falschfahrer"
] as const;

export function badgeFor(distanceKm: number, sameContinent: boolean): string {
  if (distanceKm <= 0.5) return "Punktlandung";
  if (distanceKm < 25) return "Satellitenhirn";
  if (distanceKm < 150) return "Weltenbummler";
  if (distanceKm < 750) return "Atlas-Akrobat";
  if (sameContinent) return "Kontinent-Kenner";
  return "Verschollen";
}

export function rankingTitleFor(index: number): string {
  return rankingTitles[Math.min(index, rankingTitles.length - 1)] ?? rankingTitles[rankingTitles.length - 1];
}

export function rankResults(results: RoundResult[]): RoundResult[] {
  return [...results]
    .sort((a, b) => b.points - a.points || a.distanceKm - b.distanceKm)
    .map((result, index) => ({
      ...result,
      badge: result.countryCorrect ? "Richtiges Land" : rankingTitleFor(index)
    }));
}

export function clampLatLng(point: LatLng): LatLng {
  return {
    lat: Math.max(-85, Math.min(85, point.lat)),
    lng: Math.max(-180, Math.min(180, point.lng))
  };
}

export function countryCodeFromGuess(guess: LatLng): string | undefined {
  if (guess.lat > 35 && guess.lng > -10 && guess.lng < 45) return "EU";
  if (guess.lat > 20 && guess.lng < -50 && guess.lng > -130) return "US";
  if (guess.lat < -10 && guess.lng > 110) return "AU";
  if (guess.lat > -35 && guess.lat < 35 && guess.lng > -20 && guess.lng < 55) return "AF";
  return undefined;
}

const countryHitBoxes: Record<string, Array<{ minLat: number; maxLat: number; minLng: number; maxLng: number }>> = {
  JP: [{ minLat: 24, maxLat: 46, minLng: 123, maxLng: 146 }],
  BR: [{ minLat: -34, maxLat: 6, minLng: -74, maxLng: -34 }],
  ZA: [{ minLat: -35, maxLat: -22, minLng: 16, maxLng: 33 }],
  FR: [{ minLat: 41, maxLat: 51.5, minLng: -5.5, maxLng: 9.8 }]
};

export function isGuessInCountry(guess: LatLng, countryCode: string): boolean {
  return (
    countryHitBoxes[countryCode]?.some(
      (box) => guess.lat >= box.minLat && guess.lat <= box.maxLat && guess.lng >= box.minLng && guess.lng <= box.maxLng
    ) ?? false
  );
}
