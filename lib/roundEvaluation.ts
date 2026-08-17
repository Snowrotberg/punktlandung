import { badgeFor, countryCodeFromGuess, haversineDistanceKm, isGuessInCountry, scoreDistance } from "./geo";
import { evaluateTerritoryGuess } from "./locationBoundaries";
import type { GeoLocation, Guess, RoundResult } from "../types/game";

export const missingGuessDistanceKm = 20038;

/**
 * Pure scoring entry point shared by local previews and trusted server flows.
 * Persistence and authentication deliberately stay outside this function.
 */
export function evaluatePlayerGuess(playerId: string, location: GeoLocation, guess: Guess | null): RoundResult {
  if (!guess) {
    return {
      playerId,
      distanceKm: missingGuessDistanceKm,
      points: 0,
      badge: "Verschollen",
      eliminated: false,
      guess,
      countryCorrect: false
    };
  }

  const distanceKm = haversineDistanceKm(guess, location);
  const guessedCountry = guess.countryCode ?? countryCodeFromGuess(guess);
  const countryCorrect =
    location.category === "flags" &&
    (guessedCountry === location.countryCode || isGuessInCountry(guess, location.countryCode));
  const territoryMatch = evaluateTerritoryGuess(location, guess);
  const sameContinent = countryCorrect || guessedCountry === location.countryCode || guessedCountry === location.continent;

  return {
    playerId,
    distanceKm: territoryMatch?.distanceKm ?? distanceKm,
    points: countryCorrect ? 5000 : territoryMatch?.points ?? scoreDistance(distanceKm),
    badge: countryCorrect ? "Richtiges Land" : territoryMatch?.badge ?? badgeFor(distanceKm, sameContinent),
    eliminated: false,
    guess,
    countryCorrect: countryCorrect || (territoryMatch?.isTerritoryHit ?? false)
  };
}
