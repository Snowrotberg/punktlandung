import type { RankedIntegrityStatus } from "./rankedGame";

export type SaveGamePromptStatus =
  | "unseen"
  | "offered"
  | "dismissed"
  | "authenticating"
  | "claiming"
  | "saved"
  | "failed";

export type SaveGamePromptState = {
  gameId: string;
  status: SaveGamePromptStatus;
  errorCode: "auth_failed" | "claim_failed" | null;
};

export type SaveGamePromptEvent =
  | { type: "OFFER" }
  | { type: "DISMISS" }
  | { type: "ACCEPT"; alreadyAuthenticated: boolean }
  | { type: "AUTH_SUCCESS" }
  | { type: "AUTH_FAILURE" }
  | { type: "CLAIM_SUCCESS" }
  | { type: "CLAIM_FAILURE" }
  | { type: "RETRY"; alreadyAuthenticated: boolean };

export type SaveGameOfferContext = {
  gameId: string;
  gameCompleted: boolean;
  claimed: boolean;
  guestSessionAvailable: boolean;
  integrityStatus: RankedIntegrityStatus;
};

export type SaveGameAnalyticsEvent =
  | "save_prompt_view"
  | "save_prompt_accept"
  | "save_prompt_dismiss"
  | "auth_success"
  | "auth_failure"
  | "game_claim_success"
  | "game_claim_failure";

export function initialSaveGamePromptState(gameId: string): SaveGamePromptState {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(gameId)) throw new Error("Save prompt game ID is invalid.");
  return { gameId, status: "unseen", errorCode: null };
}

export function shouldOfferSaveGame(state: SaveGamePromptState, context: SaveGameOfferContext): boolean {
  return state.gameId === context.gameId
    && state.status === "unseen"
    && context.gameCompleted
    && !context.claimed
    && context.guestSessionAvailable
    && context.integrityStatus !== "invalid";
}

/** One prompt per game. Dismissal is terminal so free play never becomes coercive. */
export function transitionSaveGamePrompt(state: SaveGamePromptState, event: SaveGamePromptEvent): SaveGamePromptState {
  switch (event.type) {
    case "OFFER":
      return state.status === "unseen" ? { ...state, status: "offered" } : state;
    case "DISMISS":
      return state.status === "offered" || state.status === "failed"
        ? { ...state, status: "dismissed", errorCode: null }
        : state;
    case "ACCEPT":
      return state.status === "offered"
        ? { ...state, status: event.alreadyAuthenticated ? "claiming" : "authenticating", errorCode: null }
        : state;
    case "AUTH_SUCCESS":
      return state.status === "authenticating" ? { ...state, status: "claiming", errorCode: null } : state;
    case "AUTH_FAILURE":
      return state.status === "authenticating" ? { ...state, status: "failed", errorCode: "auth_failed" } : state;
    case "CLAIM_SUCCESS":
      return state.status === "claiming" ? { ...state, status: "saved", errorCode: null } : state;
    case "CLAIM_FAILURE":
      return state.status === "claiming" ? { ...state, status: "failed", errorCode: "claim_failed" } : state;
    case "RETRY":
      return state.status === "failed"
        ? { ...state, status: event.alreadyAuthenticated ? "claiming" : "authenticating", errorCode: null }
        : state;
  }
}

export function analyticsForSaveGameEvent(event: SaveGamePromptEvent): SaveGameAnalyticsEvent | null {
  switch (event.type) {
    case "OFFER": return "save_prompt_view";
    case "ACCEPT": return "save_prompt_accept";
    case "DISMISS": return "save_prompt_dismiss";
    case "AUTH_SUCCESS": return "auth_success";
    case "AUTH_FAILURE": return "auth_failure";
    case "CLAIM_SUCCESS": return "game_claim_success";
    case "CLAIM_FAILURE": return "game_claim_failure";
    case "RETRY": return null;
  }
}
