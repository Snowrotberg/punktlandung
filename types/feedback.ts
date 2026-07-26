import type { LocationCategory, RoomKind } from "@/types/game";

export type FeedbackSource = "post-game" | "feedback-page";

export type FeedbackContext = {
  source: FeedbackSource;
  mode?: RoomKind;
  category?: LocationCategory;
  rounds?: number;
};

export type FeedbackPayload = FeedbackContext & {
  message: string;
  email?: string;
  website?: string;
  openedAt: number;
};
