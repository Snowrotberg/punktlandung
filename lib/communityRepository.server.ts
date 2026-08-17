import "server-only";

import type { CommunitySort, CommunityStatus, CommunitySuggestion } from "@/lib/community";
import { communityAuthorLabel, communityPublicStatuses } from "@/lib/community";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";

type SuggestionRow = {
  suggestion_id: string;
  author_account_id: string | null;
  author_label: string;
  title: string;
  details: string;
  status: CommunityStatus;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type CommunityReadResult = {
  available: boolean;
  suggestions: CommunitySuggestion[];
};

export function sortCommunitySuggestions(items: CommunitySuggestion[], sort: CommunitySort): CommunitySuggestion[] {
  return [...items].sort((left, right) => {
    if (sort === "new") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (sort === "top") return right.voteCount - left.voteCount || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    const leftAge = Math.max(1, (Date.now() - Date.parse(left.createdAt)) / 86_400_000);
    const rightAge = Math.max(1, (Date.now() - Date.parse(right.createdAt)) / 86_400_000);
    return right.voteCount / Math.pow(rightAge + 2, 0.45) - left.voteCount / Math.pow(leftAge + 2, 0.45)
      || Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

async function hydrate(
  rows: SuggestionRow[],
  viewerAccountId?: string | null,
  includeModerationNotes = false,
  resolveAuthors = true
): Promise<CommunitySuggestion[]> {
  if (!rows.length) return [];
  const admin = createSupabaseAdminClient();
  const ids = rows.map((row) => row.suggestion_id);
  const accountIds = [...new Set(rows.map((row) => row.author_account_id).filter((value): value is string => Boolean(value)))];
  const [votes, profiles] = await Promise.all([
    admin.from("community_votes").select("suggestion_id, account_id").in("suggestion_id", ids),
    resolveAuthors
      ? admin.from("profiles").select("account_id, handle, visibility, status").in("account_id", accountIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (votes.error) throw votes.error;
  if (profiles.error) throw profiles.error;
  const counts = new Map<string, number>();
  const viewerVotes = new Set<string>();
  const authorLabels = new Map((profiles.data ?? []).map((profile) => [
    profile.account_id,
    communityAuthorLabel(profile)
  ]));
  for (const vote of votes.data ?? []) {
    counts.set(vote.suggestion_id, (counts.get(vote.suggestion_id) ?? 0) + 1);
    if (viewerAccountId && vote.account_id === viewerAccountId) viewerVotes.add(vote.suggestion_id);
  }
  return rows.map((row) => ({
    suggestionId: row.suggestion_id,
    authorAccountId: row.author_account_id,
    authorLabel: row.author_account_id
      ? authorLabels.get(row.author_account_id) ?? "Punktlandung-Spieler"
      : row.author_label,
    title: row.title,
    details: row.details,
    status: row.status,
    moderationNote: includeModerationNotes ? row.moderation_note : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    voteCount: counts.get(row.suggestion_id) ?? 0,
    votedByViewer: viewerVotes.has(row.suggestion_id)
  }));
}

export async function readCommunitySuggestions(options: {
  viewerAccountId?: string | null;
  sort?: CommunitySort;
  status?: CommunityStatus | "all";
  ownOnly?: boolean;
  admin?: boolean;
} = {}): Promise<CommunityReadResult> {
  const admin = createSupabaseAdminClient();
  let query = admin.from("community_suggestions")
    .select("suggestion_id, author_account_id, author_label, title, details, status, moderation_note, created_at, updated_at, published_at")
    .order("created_at", { ascending: false });

  if (options.admin) {
    if (options.status && options.status !== "all") query = query.eq("status", options.status);
  } else if (options.ownOnly && options.viewerAccountId) {
    query = query.eq("author_account_id", options.viewerAccountId);
  } else if (options.status && options.status !== "all" && communityPublicStatuses.includes(options.status as typeof communityPublicStatuses[number])) {
    query = query.eq("status", options.status);
  } else {
    query = query.in("status", [...communityPublicStatuses]);
  }

  const result = await query;
  if (result.error) {
    if (result.error.code !== "PGRST205") console.error("Community suggestions could not be read", result.error.message);
    return { available: false, suggestions: [] };
  }
  const suggestions = await hydrate(
    (result.data ?? []) as SuggestionRow[],
    options.viewerAccountId,
    options.admin === true,
    options.ownOnly !== true
  );
  return { available: true, suggestions: sortCommunitySuggestions(suggestions, options.sort ?? "trending") };
}
