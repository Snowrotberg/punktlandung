"use server";

import { revalidatePath } from "next/cache";
import {
  cleanCommunityDetails,
  cleanCommunityTitle,
  communityRoadmapStatuses,
  type CommunityStatus
} from "@/lib/community";
import { getAdminAccountContext } from "@/lib/adminAccess.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";

export async function moderateCommunitySuggestion(formData: FormData) {
  const context = await getAdminAccountContext();
  if (!context) return;
  const suggestionId = String(formData.get("suggestionId") ?? "");
  if (!/^suggestion_[a-f0-9]{32}$/.test(suggestionId)) return;

  const mode = String(formData.get("mode") ?? "");
  const requestedStatus = mode === "review"
    ? String(formData.get("decision") ?? "") === "approve" ? "approved" : "declined"
    : String(formData.get("status") ?? "");
  if (mode !== "review" && mode !== "roadmap") return;
  if (!communityRoadmapStatuses.includes(requestedStatus as typeof communityRoadmapStatuses[number])) return;

  const status = requestedStatus as CommunityStatus;
  const title = cleanCommunityTitle(formData.get("title"));
  const details = cleanCommunityDetails(formData.get("details"));
  if (!title || !details) return;
  const moderationNote = String(formData.get("moderationNote") ?? "").trim().slice(0, 1000) || null;
  const now = new Date().toISOString();
  const published = status === "approved" || status === "planned" || status === "in_progress" || status === "completed";
  const admin = createSupabaseAdminClient();
  const current = await admin.from("community_suggestions")
    .select("status, published_at")
    .eq("suggestion_id", suggestionId)
    .maybeSingle();
  if (current.error || !current.data || (mode === "review" && current.data.status !== "pending")) return;

  const result = await admin.from("community_suggestions").update({
    status,
    title,
    details,
    moderation_note: moderationNote,
    moderated_by: context.identity.account.accountId,
    moderated_at: now,
    published_at: published ? current.data.published_at ?? now : null,
    updated_at: now
  }).eq("suggestion_id", suggestionId);
  if (result.error) console.error("Community suggestion could not be moderated", result.error.message);
  revalidatePath("/community");
  revalidatePath("/community/meine-vorschlaege");
  revalidatePath("/admin");
}
