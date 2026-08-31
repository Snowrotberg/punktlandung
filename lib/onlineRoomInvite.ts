export const ONLINE_ROOM_CODE_LENGTH = 6;

const roomCodePattern = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeOnlineRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function onlineRoomCodeValidationMessage(value: string): string | null {
  const code = normalizeOnlineRoomCode(value);
  if (!code) return "Gib einen Raumcode ein.";
  if (code.length !== ONLINE_ROOM_CODE_LENGTH) return "Ein Raumcode besteht aus 6 Zeichen.";
  if (!roomCodePattern.test(code)) return "Dieser Raumcode enthält ungültige Zeichen.";
  return null;
}

export function onlineRoomPath(codeInput: string): string {
  const query = new URLSearchParams({ room: normalizeOnlineRoomCode(codeInput) });
  return `/online-modus?${query.toString()}`;
}

export function onlineRoomInviteUrl(baseUrl: string, codeInput: string): URL {
  const url = new URL("/online-modus", baseUrl);
  url.search = "";
  url.searchParams.set("room", normalizeOnlineRoomCode(codeInput));
  return url;
}
