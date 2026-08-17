import type { GameSettings } from "@/types/game";

const setupSettingsStorageKey = "punktlandung-setup-settings-v3";
const setupSettingsCookieKey = "punktlandung-setup-settings-v3";
const locationCategories = new Set(["mixed", "landmarks", "cities", "landscapes", "flags", "capitals", "streetview"]);

export type SharedSetupSettings = Pick<GameSettings, "timeLimitSec" | "rounds" | "noMove" | "noPan" | "noZoom" | "category" | "difficulty">;
let inMemorySetupSettings: Partial<SharedSetupSettings> = {};
type SetupSettingsWindow = Window & { __punktlandungSetupSettings?: Partial<SharedSetupSettings> };

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export function readStoredSetupSettings(defaults: GameSettings): Partial<SharedSetupSettings> {
  if (typeof window === "undefined") return inMemorySetupSettings;
  const windowSettings = (window as SetupSettingsWindow).__punktlandungSetupSettings ?? {};
  const query = new URLSearchParams(window.location.search);
  const querySettings: Partial<SharedSetupSettings> = query.has("rounds") || query.has("time") ? {
    timeLimitSec: boundedInteger(query.get("time"), defaults.timeLimitSec, 0, 600),
    rounds: boundedInteger(query.get("rounds"), defaults.rounds, 1),
    noMove: query.get("noMove") === "1",
    noPan: query.get("noPan") === "1",
    noZoom: query.get("noZoom") === "1",
    category: (query.get("category") || defaults.category) as GameSettings["category"],
    difficulty: (query.get("difficulty") as GameSettings["difficulty"]) || defaults.difficulty
  } : {};
  let cookieSettings: Partial<SharedSetupSettings> = {};
  try {
    const cookieValue = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${setupSettingsCookieKey}=`))
      ?.slice(setupSettingsCookieKey.length + 1);
    if (cookieValue) cookieSettings = JSON.parse(decodeURIComponent(cookieValue)) as Partial<SharedSetupSettings>;
  } catch {
    cookieSettings = {};
  }
  try {
    const parsed = {
      ...inMemorySetupSettings,
      ...windowSettings,
      ...cookieSettings,
      ...(JSON.parse(window.localStorage.getItem(setupSettingsStorageKey) || "{}") as Partial<SharedSetupSettings>),
      ...querySettings
    };
    return {
      timeLimitSec: boundedInteger(parsed.timeLimitSec, defaults.timeLimitSec, 0, 600),
      rounds: boundedInteger(parsed.rounds, defaults.rounds, 1),
      noMove: typeof parsed.noMove === "boolean" ? parsed.noMove : defaults.noMove,
      noPan: typeof parsed.noPan === "boolean" ? parsed.noPan : defaults.noPan,
      noZoom: typeof parsed.noZoom === "boolean" ? parsed.noZoom : defaults.noZoom,
      category: typeof parsed.category === "string" && locationCategories.has(parsed.category) ? parsed.category : defaults.category,
      difficulty: parsed.difficulty === "easy" || parsed.difficulty === "medium" || parsed.difficulty === "hard" || parsed.difficulty === "mixed" ? parsed.difficulty : defaults.difficulty
    };
  } catch {
    return { ...inMemorySetupSettings, ...windowSettings, ...cookieSettings, ...querySettings };
  }
}

export function writeStoredSetupSettings(settings: GameSettings): void {
  if (typeof window === "undefined") return;
  const shared: SharedSetupSettings = {
    timeLimitSec: settings.timeLimitSec,
    rounds: settings.rounds,
    noMove: settings.noMove,
    noPan: settings.noPan,
    noZoom: settings.noZoom,
    category: settings.category,
    difficulty: settings.difficulty
  };
  inMemorySetupSettings = shared;
  (window as SetupSettingsWindow).__punktlandungSetupSettings = shared;
  document.cookie = `${setupSettingsCookieKey}=${encodeURIComponent(JSON.stringify(shared))}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(setupSettingsStorageKey, JSON.stringify(shared));
  } catch {
    // Settings persistence is optional in restricted browser modes.
  }
}
