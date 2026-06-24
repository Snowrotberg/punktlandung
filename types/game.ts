export type GameMode = "classic" | "crew" | "elimination" | "duel";
export type LocationCategory = "mixed" | "landmarks" | "cities" | "landscapes" | "flags" | "capitals" | "streetview";
export type LocalMode = "solo" | "couch";

export type PlayerStatus = "active" | "eliminated";

export type TeamId = "aurora" | "pulse";

export type Cosmetic = "none" | "crown" | "visor" | "halo" | "neon-frame";

export type LatLng = {
  lat: number;
  lng: number;
};

export type LocationSource = "wikimedia" | "mapillary-ready" | "kartaview-ready" | "ugc";
export type LocationDifficulty = "easy" | "medium" | "hard";

export type GeoLocation = LatLng & {
  id: string;
  title: string;
  countryCode: string;
  countryName: string;
  continent: string;
  panoramaUrl: string;
  panoramaUrls?: string[];
  attribution: string;
  source: LocationSource;
  sourceUrl?: string;
  category: LocationCategory;
  wikidataId?: string;
  imageFile?: string;
  difficulty?: LocationDifficulty;
  popularity?: number;
};

export type GameSettings = {
  mode: GameMode;
  localMode: LocalMode;
  localPlayerCount: number;
  timeLimitSec: number;
  rounds: number;
  noMove: boolean;
  noPan: boolean;
  noZoom: boolean;
  mapPackId: string;
  category: LocationCategory;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  team: TeamId;
  status: PlayerStatus;
  cosmetic: Cosmetic;
  localOnly?: boolean;
};

export type Guess = LatLng & {
  playerId: string;
  countryCode?: string;
  createdAt: number;
  responseTimeMs?: number;
};

export type RoundStatus = "lobby" | "guessing" | "results" | "finished";
export type RoomKind = "solo" | "party" | "online";
export type HostParticipation = "host_player" | "host_only";

export type RoundResult = {
  playerId: string;
  distanceKm: number;
  points: number;
  badge: string;
  eliminated: boolean;
  guess: Guess | null;
  countryCorrect: boolean;
};

export type TeamResult = {
  team: TeamId;
  averageDistanceKm: number;
  hp: number;
};

export type RoundSummary = {
  roundNumber: number;
  location: GeoLocation;
  results: RoundResult[];
  crewGuess: LatLng | null;
  crewDistanceKm: number | null;
  duel: TeamResult[];
  completedAt: number;
  roundStartedAt?: number;
};

export type RoomState = {
  code: string;
  kind: RoomKind;
  hostId: string;
  hostParticipation: HostParticipation;
  hostPlayerName?: string;
  status: RoundStatus;
  settings: GameSettings;
  players: Player[];
  currentRound: number;
  location: GeoLocation | null;
  guesses: Guess[];
  timedOutPlayerIds: string[];
  roundEndsAt: number | null;
  roundStartedAt: number | null;
  summaries: RoundSummary[];
  emojiEvents: EmojiEventPayload[];
  adGateUntil: number | null;
};

export type EmojiEventPayload = {
  id: string;
  playerId: string;
  emoji: string;
  x: number;
  createdAt: number;
};

export type ClientMessage =
  | { type: "create_room"; playerName: string }
  | { type: "create_online_room"; playerName?: string; hostParticipation?: HostParticipation }
  | { type: "create_solo"; playerName: string }
  | { type: "join_room"; code: string; playerName: string }
  | { type: "update_settings"; settings: Partial<GameSettings> }
  | { type: "start_round" }
  | { type: "submit_guess"; guess: LatLng; countryCode?: string; playerId?: string }
  | { type: "send_emoji"; emoji: string; x: number }
  | { type: "unlock_cosmetic"; cosmetic: Cosmetic }
  | { type: "set_team"; team: TeamId }
  | { type: "cancel_round" }
  | { type: "skip_location"; locationId?: string }
  | { type: "leave_room" }
  | { type: "restart" };

export type ServerMessage =
  | { type: "hello"; playerId: string }
  | { type: "room_state"; state: RoomState }
  | { type: "left_room" }
  | { type: "error"; message: string };

export type CommunityMapPack = {
  id: string;
  name: string;
  author: string;
  description: string;
  rating: number;
  locations: GeoLocation[];
};
