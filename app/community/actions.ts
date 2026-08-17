"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cleanCommunityDetails, cleanCommunityTitle, communityAuthorLabel, communityPublicStatuses, validateCommunitySuggestion } from "@/lib/community";
import { notifyAboutCommunitySuggestion } from "@/lib/communityNotification.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { RankedGuestSessionCodec, RankedGuestSessionError } from "@/lib/rankedGuestSession.server";

const communityGuestCookieName = "pl_community_guest";

async function communityGuestIdHash(): Promise<string> {
  const secrets = [process.env.GAME_SESSION_SECRET, process.env.GAME_SESSION_PREVIOUS_SECRET]
    .filter((value): value is string => Boolean(value));
  if (secrets.length === 0) throw new Error("Guest community suggestions require GAME_SESSION_SECRET.");

  const codec = new RankedGuestSessionCodec(secrets, 7 * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(communityGuestCookieName)?.value;
  if (currentToken) {
    try {
      return codec.verify(currentToken).guestIdHash;
    } catch (error) {
      if (!(error instanceof RankedGuestSessionError)) throw error;
    }
  }

  const issued = codec.issue();
  cookieStore.set(communityGuestCookieName, issued.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/community",
    maxAge: 7 * 24 * 60 * 60
  });
  return issued.session.guestIdHash;
}

function communityUrl(kind: "error" | "submitted", value: string): string {
  return `/community?${new URLSearchParams({ [kind]: value }).toString()}#vorschlagen`;
}

export async function createCommunitySuggestion(formData: FormData) {
  const context = await getSupabaseAccountContext();

  const title = cleanCommunityTitle(formData.get("title"));
  const details = cleanCommunityDetails(formData.get("details"));
  const validationError = validateCommunitySuggestion(title, details);
  if (validationError) redirect(communityUrl("error", validationError));

  const admin = createSupabaseAdminClient();
  const accountId = context?.identity.account.accountId ?? null;
  let guestIdHash: string | null = null;
  if (!accountId) {
    try {
      guestIdHash = await communityGuestIdHash();
    } catch {
      redirect(communityUrl("error", "Gastvorschläge sind noch nicht vollständig eingerichtet."));
    }
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let recentQuery = admin.from("community_suggestions")
    .select("suggestion_id", { count: "exact", head: true })
    .gte("created_at", since);
  recentQuery = accountId
    ? recentQuery.eq("author_account_id", accountId)
    : recentQuery.eq("guest_id_hash", guestIdHash as string);
  const recent = await recentQuery;
  if (recent.error) redirect(communityUrl("error", "Der Community-Bereich ist noch nicht vollständig eingerichtet."));
  const dailyLimit = accountId ? 3 : 1;
  if ((recent.count ?? 0) >= dailyLimit) {
    redirect(communityUrl("error", accountId
      ? "Du kannst innerhalb von 24 Stunden höchstens drei Ideen einreichen."
      : "Ohne Konto kannst du innerhalb von 24 Stunden eine Idee einreichen."));
  }

  const profile = accountId
    ? await admin.from("profiles").select("handle, visibility, status").eq("account_id", accountId).maybeSingle()
    : { data: null };
  const authorLabel = accountId ? communityAuthorLabel(profile.data) : "Gast";

  const result = await admin.from("community_suggestions").insert({
    suggestion_id: `suggestion_${randomUUID().replaceAll("-", "")}`,
    author_account_id: accountId,
    guest_id_hash: guestIdHash,
    author_label: authorLabel,
    title,
    details
  });
  if (result.error) {
    console.error("Community suggestion could not be created", result.error.message);
    redirect(communityUrl("error", "Deine Idee konnte gerade nicht gespeichert werden."));
  }

  try {
    await notifyAboutCommunitySuggestion({ title, details, authorLabel });
  } catch (error) {
    console.error("Community suggestion notification failed", error instanceof Error ? error.message : "unknown error");
  }

  revalidatePath("/community");
  revalidatePath("/community/meine-vorschlaege");
  revalidatePath("/admin");
  redirect(communityUrl("submitted", "1"));
}

export async function toggleCommunityVote(formData: FormData) {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fcommunity");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  if (!/^suggestion_[a-f0-9]{32}$/.test(suggestionId)) return;

  const admin = createSupabaseAdminClient();
  const suggestion = await admin.from("community_suggestions").select("status").eq("suggestion_id", suggestionId).maybeSingle();
  if (suggestion.error || !suggestion.data || !communityPublicStatuses.includes(suggestion.data.status as typeof communityPublicStatuses[number])) return;

  const accountId = context.identity.account.accountId;
  const existing = await admin.from("community_votes")
    .select("suggestion_id")
    .eq("suggestion_id", suggestionId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (existing.data) {
    await admin.from("community_votes").delete().eq("suggestion_id", suggestionId).eq("account_id", accountId);
  } else {
    await admin.from("community_votes").insert({ suggestion_id: suggestionId, account_id: accountId });
  }
  revalidatePath("/community");
}
