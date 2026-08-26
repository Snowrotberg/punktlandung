import type { LeaderboardCategory, LeaderboardPeriod, PublicLeaderboardEntry } from "@/lib/leaderboards";
import type { LocationCategory } from "@/types/game";

export type LeaderboardDisplayEntry = PublicLeaderboardEntry & {
  isExample: boolean;
};

type StarterProfile = {
  handle: string;
  comparisonValue: number;
  rounds: number;
  timeLimitSec: 15 | 30 | 60;
  difficulty: "easy" | "medium" | "hard";
  noZoom: boolean;
};

export type LeaderboardDisplayContext = {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  periodKey: string;
  now: number;
};

const rounds = [18, 10, 14, 20, 12, 15, 17, 10, 16, 13, 19, 10, 18, 15, 20] as const;
const timeLimits = [60, 30, 60, 15, 30, 60, 15, 60, 30, 60, 15, 30, 60, 15, 30] as const;
const difficulties = ["medium", "easy", "hard", "medium", "medium", "hard", "easy", "medium", "hard", "easy", "medium", "hard", "medium", "easy", "hard"] as const;

const starterFields: Record<Exclude<LocationCategory, "streetview">, { handles: readonly string[]; highest: number; lowest: number }> = {
  mixed: { handles: ["Lena", "n0va", "Apfelkern", "Miri", "Velox", "Jannis", "blauwal", "Karo", "Nebelkind", "Mike", "Wegfinder", "Sora", "Emil", "quokka", "Nordlicht"], highest: 4_145, lowest: 2_450 },
  landmarks: { handles: ["Mara", "PixelPaul", "Runa", "Denkpause", "Elias", "Keksdose", "Lumen", "Nika", "Sonntagskind"], highest: 4_000, lowest: 2_400 },
  cities: { handles: ["Jonas", "AvocadoToast", "Selin", "m0chi", "Pia", "Falk", "Regenjacke", "Liv", "Zeno", "Emma", "Tarek", "flauschig", "Mo", "Kira"], highest: 4_200, lowest: 2_350 },
  landscapes: { handles: ["Luisa", "Nebelflug", "Ben", "yuki", "Flora", "Matti", "WildeHilde"], highest: 3_950, lowest: 2_300 },
  flags: { handles: ["Chris", "Farbklecks", "Aylin", "Rudi", "bingo", "Sam", "Pola", "Theo"], highest: 4_300, lowest: 2_450 },
  capitals: { handles: ["Hannah", "Orbit", "David", "Lotti", "kaffeeleer", "Nils", "Mira", "Roman", "Feli", "Jo", "Wolke7", "Anna", "Pascal"], highest: 4_150, lowest: 2_350 }
};

const starterTargets: Record<Exclude<LocationCategory, "streetview">, Record<LeaderboardPeriod, number>> = {
  mixed: { daily: 2, weekly: 6, monthly: 11, yearly: 15 },
  landmarks: { daily: 1, weekly: 4, monthly: 7, yearly: 9 },
  cities: { daily: 2, weekly: 6, monthly: 10, yearly: 14 },
  landscapes: { daily: 1, weekly: 3, monthly: 5, yearly: 7 },
  flags: { daily: 1, weekly: 4, monthly: 6, yearly: 8 },
  capitals: { daily: 2, weekly: 5, monthly: 9, yearly: 13 }
};

function starterProfiles(category: LeaderboardCategory): StarterProfile[] {
  if (category === "all") {
    return (Object.keys(starterFields) as Array<Exclude<LocationCategory, "streetview">>)
      .flatMap((rankedCategory) => starterProfiles(rankedCategory))
      .sort((left, right) => right.comparisonValue - left.comparisonValue || left.handle.localeCompare(right.handle, "de-DE"));
  }
  if (category === "streetview") return [];
  const field = starterFields[category];
  const spread = Math.max(1, field.handles.length - 1);
  const categoryOffset = Object.keys(starterFields).indexOf(category);
  return field.handles.map((handle, index) => ({
    handle,
    comparisonValue: Math.round(field.highest - ((field.highest - field.lowest) * index) / spread),
    rounds: rounds[(index + categoryOffset) % rounds.length],
    timeLimitSec: timeLimits[(index + categoryOffset * 2) % timeLimits.length],
    difficulty: difficulties[(index + categoryOffset) % difficulties.length],
    noZoom: (index + categoryOffset) % 6 === 5
  }));
}

function profilesForPeriod(context: LeaderboardDisplayContext): StarterProfile[] {
  if (context.category === "streetview") return [];
  const targetCategory = context.category === "all" ? "mixed" : context.category;
  return starterProfiles(context.category).slice(0, starterTargets[targetCategory][context.period]);
}

export function leaderboardDisplayTarget(context: LeaderboardDisplayContext): number {
  return profilesForPeriod(context).length;
}

export function buildLeaderboardDisplayEntries(
  entries: PublicLeaderboardEntry[],
  context: LeaderboardDisplayContext
): LeaderboardDisplayEntry[] {
  const profiles = profilesForPeriod(context);
  const realEntries = entries.map((entry) => ({ ...entry, isExample: false }));
  if (realEntries.length >= profiles.length) return realEntries;

  const realHandles = new Set(realEntries.map((entry) => entry.publicHandle.trim().toLocaleLowerCase("de-DE")));
  const availableProfiles = profiles.filter((profile) => !realHandles.has(profile.handle.toLocaleLowerCase("de-DE")));
  const missing = Math.max(0, profiles.length - realEntries.length);
  const examples = availableProfiles.slice(0, missing).map((profile): LeaderboardDisplayEntry => {
    const comparisonValue = profile.comparisonValue;
    const timeFactor = profile.timeLimitSec === 15 ? 1.25 : profile.timeLimitSec === 30 ? 1.1 : 1;
    const difficultyFactor = profile.difficulty === "hard" ? 1.15 : profile.difficulty === "medium" ? 1.05 : 1;
    const restrictionFactor = profile.noZoom ? 1.1 : 1;
    const averagePointsPerRound = Math.max(0, Math.round(comparisonValue / (timeFactor * difficultyFactor * restrictionFactor)));
    return {
      rank: 0,
      publicHandle: profile.handle,
      score: averagePointsPerRound * profile.rounds,
      comparisonValue,
      difficulty: profile.difficulty,
      roundDurationMs: profile.timeLimitSec * 1000,
      timeLimitSec: profile.timeLimitSec,
      noZoom: profile.noZoom,
      gamesCount: 0,
      bestScore: averagePointsPerRound * profile.rounds,
      totalResponseTimeMs: 0,
      averagePointsPerRound,
      roundsPlayed: profile.rounds,
      isExample: true
    };
  });

  return [...realEntries, ...examples]
    .sort((left, right) => (right.comparisonValue ?? right.score) - (left.comparisonValue ?? left.score))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
