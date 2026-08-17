export const communityPublicStatuses = ["approved", "planned", "in_progress", "completed"] as const;
export const communityStatuses = ["pending", ...communityPublicStatuses, "declined"] as const;
export const communityRoadmapStatuses = [...communityPublicStatuses, "declined"] as const;

export type CommunityStatus = typeof communityStatuses[number];
export type CommunitySort = "trending" | "top" | "new";

export const communityStatusLabels: Record<CommunityStatus, string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  planned: "Geplant",
  in_progress: "In Arbeit",
  completed: "Umgesetzt",
  declined: "Nicht vorgesehen"
};

export const communityUserStatusLabels: Record<CommunityStatus, string> = {
  ...communityStatusLabels,
  pending: "Eingereicht"
};

export type CommunitySuggestion = {
  suggestionId: string;
  authorAccountId: string | null;
  authorLabel: string;
  title: string;
  details: string;
  status: CommunityStatus;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  voteCount: number;
  votedByViewer: boolean;
};

export function communityAuthorLabel(profile: {
  handle: string;
  visibility: string;
  status?: string;
} | null | undefined): string {
  return profile?.visibility === "public" && (!profile.status || profile.status === "active")
    ? `@${profile.handle}`
    : "Punktlandung-Spieler";
}

export function cleanCommunityTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 100) : "";
}

export function cleanCommunityDetails(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\r\n/g, "\n").slice(0, 2000) : "";
}

export function validateCommunitySuggestion(title: string, details: string): string | null {
  if (title.length < 8) return "Gib deiner Idee bitte einen Titel mit mindestens acht Zeichen.";
  if (details.length < 20) return "Beschreibe deine Idee bitte mit mindestens 20 Zeichen.";
  return null;
}

const similarityStopWords = new Set([
  "aber", "auch", "das", "dass", "der", "die", "eine", "einem", "einen", "einer", "eines",
  "für", "haben", "hier", "ist", "kann", "können", "mit", "oder", "sich", "soll", "und", "von", "wie", "wird", "zu"
]);

function searchableWords(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[^a-z0-9äöüß\s-]/gi, " ")
    .split(/[\s-]+/)
    .filter((word) => word.length >= 3 && !similarityStopWords.has(word)));
}

export function relatedCommunitySuggestions<T extends Pick<CommunitySuggestion, "suggestionId" | "title" | "details" | "voteCount">>(
  input: string,
  suggestions: readonly T[],
  limit = 3
): T[] {
  const inputWords = searchableWords(input);
  if (inputWords.size < 2) return [];
  return suggestions
    .map((suggestion) => {
      const titleWords = searchableWords(suggestion.title);
      const detailWords = searchableWords(suggestion.details);
      let score = 0;
      for (const word of inputWords) {
        if (titleWords.has(word)) score += 3;
        else if (detailWords.has(word)) score += 1;
      }
      return { suggestion, score };
    })
    .filter((entry) => entry.score >= 2)
    .sort((left, right) => right.score - left.score || right.suggestion.voteCount - left.suggestion.voteCount)
    .slice(0, limit)
    .map((entry) => entry.suggestion);
}
