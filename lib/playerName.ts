export const PLAYER_NAME_MAX_LENGTH = 18;

const unsupportedPlayerNameCharacters = /[^\p{L}\p{N}\s_.-]/gu;

export function sanitizePlayerName(input: string): string {
  const trimmed = input.replace(unsupportedPlayerNameCharacters, "").trim();
  return trimmed.slice(0, PLAYER_NAME_MAX_LENGTH) || "Gast";
}

export function sanitizeEditablePlayerName(input: string): string {
  return input.replace(unsupportedPlayerNameCharacters, "").slice(0, PLAYER_NAME_MAX_LENGTH);
}
