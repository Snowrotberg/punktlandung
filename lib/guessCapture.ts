import type { Guess, LatLng, RoomState } from "../types/game";

export type GuessCapture = {
  point: LatLng & { countryCode?: string };
  playerId: string;
  roundNumber: number;
  locationId: string;
  roundStartedAt: number;
  roundEndsAt: number | null;
  capturedAt: number;
  capturedAtMonotonic: number;
};

export function captureIsWithinDeadline(capture: GuessCapture): boolean {
  return capture.roundEndsAt === null || capture.capturedAt <= capture.roundEndsAt;
}

export function captureMatchesRoom(room: RoomState, capture: GuessCapture, playerId = capture.playerId): boolean {
  return room.status === "guessing"
    && room.currentRound === capture.roundNumber
    && room.location?.id === capture.locationId
    && room.roundStartedAt === capture.roundStartedAt
    && room.roundEndsAt === capture.roundEndsAt
    && capture.playerId === playerId
    && capture.capturedAt >= capture.roundStartedAt
    && captureIsWithinDeadline(capture);
}

export function guessFromCapture(capture: GuessCapture): Guess {
  return {
    playerId: capture.playerId,
    lat: Math.max(-85, Math.min(85, capture.point.lat)),
    lng: Math.max(-180, Math.min(180, capture.point.lng)),
    countryCode: capture.point.countryCode,
    createdAt: capture.capturedAt,
    responseTimeMs: Math.max(0, capture.capturedAt - capture.roundStartedAt)
  };
}

export function serverObservedCaptureBeforeDeadline(roundStartedAt: number, roundEndsAt: number | null, receivedAt: number): boolean {
  return receivedAt >= roundStartedAt && (roundEndsAt === null || receivedAt <= roundEndsAt);
}

export function onlineSubmissionAuthorized(roundEndsAt: number | null, receivedAt: number, hasServerCapture: boolean): boolean {
  return roundEndsAt === null || receivedAt <= roundEndsAt || hasServerCapture;
}
