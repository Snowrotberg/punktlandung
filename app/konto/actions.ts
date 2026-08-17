"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAccountDeletionRequest } from "@/lib/accountDataLifecycle";
import { normalizeAccountEmail, planAccountEmailChange } from "@/lib/accountEmailChange";
import { webAuthCallbackUrl } from "@/lib/authNavigation";
import { ProfileValidationError } from "@/lib/accountProfile";
import { AccountProfileConflictError } from "@/lib/accountProfileRepository";
import { AccountProfileService } from "@/lib/accountProfileService";
import { getSupabaseAccountContext } from "@/lib/supabase/auth.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { SupabaseAccountProfileRepository } from "@/lib/supabase/accountProfileRepository.server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/seo";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function profileError(error: unknown): string {
  if (error instanceof AccountProfileConflictError && error.code === "handle_taken") {
    return "Dieser öffentliche Benutzername ist bereits vergeben. Bitte wähle einen anderen.";
  }
  if (error instanceof ProfileValidationError) {
    if (error.code === "invalid_handle") return "Der öffentliche Benutzername muss 3 bis 24 Zeichen lang sein und darf nur Buchstaben, Zahlen, Punkte, Unterstriche oder Bindestriche enthalten.";
    if (error.code === "reserved_handle") return "Dieser öffentliche Benutzername ist nicht verfügbar.";
    return "Bitte prüfe deine Profilangaben.";
  }
  return "Das Profil konnte gerade nicht gespeichert werden.";
}

function revalidateProfileConsumers(): void {
  revalidatePath("/konto");
  revalidatePath("/konto/einstellungen");
  revalidatePath("/rankings");
  revalidatePath("/community");
  revalidatePath("/community/meine-vorschlaege");
  revalidatePath("/admin");
}

export async function saveProfile(formData: FormData): Promise<void> {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto");

  const handle = field(formData, "handle");
  const displayName = field(formData, "displayName");
  const visibility = field(formData, "visibility");
  if (visibility !== "public" && visibility !== "private") {
    redirect("/konto?error=Bitte+w%C3%A4hle+eine+Profil-Sichtbarkeit.");
  }

  const profiles = new AccountProfileService(new SupabaseAccountProfileRepository());
  let errorMessage: string | null = null;
  try {
    const current = await profiles.get(context.identity.account.accountId).catch((error: unknown) => {
      if (error instanceof AccountProfileConflictError && error.code === "profile_missing") return null;
      throw error;
    });
    if (current) {
      await profiles.update(context.identity.account.accountId, { handle, displayName, visibility, now: Date.now() });
    } else {
      await profiles.create(context.identity.account.accountId, { handle, displayName, visibility, now: Date.now() });
    }
  } catch (error) {
    errorMessage = profileError(error);
  }

  if (errorMessage) {
    redirect(`/konto?error=${encodeURIComponent(errorMessage)}`);
  }
  revalidateProfileConsumers();
  redirect("/konto?saved=1");
}

export async function saveAccountSettings(formData: FormData): Promise<void> {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Feinstellungen");

  const handle = field(formData, "handle");
  const displayName = field(formData, "displayName");
  const visibility = field(formData, "visibility");
  const email = normalizeAccountEmail(field(formData, "email"));
  const password = field(formData, "password");
  const passwordConfirmation = field(formData, "passwordConfirmation");

  if (visibility !== "public" && visibility !== "private") {
    redirect("/konto/einstellungen?error=Bitte+w%C3%A4hle+eine+Profil-Sichtbarkeit.");
  }
  if (!email || email.length > 254 || !email.includes("@")) {
    redirect("/konto/einstellungen?error=Bitte+gib+eine+g%C3%BCltige+E-Mail-Adresse+ein.");
  }
  if (password && (password.length < 8 || password.length > 128 || password !== passwordConfirmation)) {
    redirect("/konto/einstellungen?error=Die+Passw%C3%B6rter+m%C3%BCssen+%C3%BCbereinstimmen+und+mindestens+8+Zeichen+lang+sein.");
  }

  let emailChangeRequested = false;
  try {
    const profiles = new AccountProfileService(new SupabaseAccountProfileRepository());
    const current = await profiles.get(context.identity.account.accountId).catch((error: unknown) => {
      if (error instanceof AccountProfileConflictError && error.code === "profile_missing") return null;
      throw error;
    });
    if (current) {
      await profiles.update(context.identity.account.accountId, { handle, displayName, visibility, now: Date.now() });
    } else {
      await profiles.create(context.identity.account.accountId, { handle, displayName, visibility, now: Date.now() });
    }

    const supabase = await createClient();
    const authUpdate: { email?: string; password?: string } = {};
    const emailPlan = planAccountEmailChange({
      currentEmail: context.user.email,
      pendingEmail: context.user.new_email,
      requestedEmail: email
    });
    if (emailPlan === "request") {
      authUpdate.email = email;
      emailChangeRequested = true;
    }
    if (password) authUpdate.password = password;
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabase.auth.updateUser(authUpdate, emailChangeRequested ? {
        emailRedirectTo: webAuthCallbackUrl(siteUrl, "/konto/einstellungen?emailConfirmed=1")
      } : undefined);
      if (error) throw error;
    }
  } catch (error) {
    const message = error instanceof Error && !(error instanceof ProfileValidationError) && !(error instanceof AccountProfileConflictError)
      ? "Die Kontoeinstellungen konnten gerade nicht gespeichert werden."
      : profileError(error);
    redirect(`/konto/einstellungen?error=${encodeURIComponent(message)}`);
  }

  revalidateProfileConsumers();
  redirect(emailChangeRequested
    ? "/konto/einstellungen?emailPending=1"
    : "/konto/einstellungen?saved=1");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function updateEmail(formData: FormData): Promise<void> {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Feinstellungen");
  const email = normalizeAccountEmail(field(formData, "email"));
  if (!email || email.length > 254 || !email.includes("@")) {
    redirect("/konto/einstellungen?error=Bitte+gib+eine+gültige+E-Mail-Adresse+ein.");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email }, {
    emailRedirectTo: webAuthCallbackUrl(siteUrl, "/konto/einstellungen?emailConfirmed=1")
  });
  if (error) redirect(`/konto/einstellungen?error=${encodeURIComponent("Die E-Mail-Adresse konnte nicht geändert werden.")}`);
  redirect("/konto/einstellungen?emailPending=1");
}

export async function updatePassword(formData: FormData): Promise<void> {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Feinstellungen");
  const password = field(formData, "password");
  const confirmation = field(formData, "passwordConfirmation");
  if (password.length < 8 || password.length > 128 || password !== confirmation) {
    redirect("/konto/einstellungen?error=Die+Passwörter+müssen+übereinstimmen+und+mindestens+8+Zeichen+lang+sein.");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/konto/einstellungen?error=${encodeURIComponent("Das Passwort konnte nicht geändert werden.")}`);
  redirect("/konto/einstellungen?saved=password");
}

async function markDeletionFailed(deletionRequestId: string, errorCode: string): Promise<void> {
  await createSupabaseAdminClient().from("account_deletion_jobs").update({
    status: "failed",
    lease_until: null,
    last_error_code: errorCode,
    updated_at: new Date().toISOString()
  }).eq("deletion_request_id", deletionRequestId);
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const context = await getSupabaseAccountContext();
  if (!context) redirect("/anmelden?returnTo=%2Fkonto%2Feinstellungen");

  if (field(formData, "confirmation") !== "LÖSCHEN") {
    redirect(`/konto/einstellungen?error=${encodeURIComponent("Bitte gib zur Bestätigung exakt LÖSCHEN ein.")}`);
  }

  const supabase = await createClient();
  let reauthenticatedAt = Date.parse(context.user.last_sign_in_at ?? "");
  if (context.provider === "email") {
    const password = field(formData, "currentPassword");
    const email = context.user.email ?? "";
    if (!email || password.length < 8 || password.length > 128) {
      redirect(`/konto/einstellungen?error=${encodeURIComponent("Bitte bestätige die Kontolöschung mit deinem aktuellen Passwort.")}`);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || data.user.id !== context.user.id) {
      redirect(`/konto/einstellungen?error=${encodeURIComponent("Das aktuelle Passwort ist nicht korrekt.")}`);
    }
    reauthenticatedAt = Date.parse(data.user.last_sign_in_at ?? new Date().toISOString());
  }

  const requestedAt = Date.now();
  let request;
  try {
    request = createAccountDeletionRequest({
      deletionRequestId: `delete_${randomUUID().replaceAll("-", "")}`,
      accountId: context.identity.account.accountId,
      requestedAt,
      reauthenticatedAt
    });
  } catch {
    redirect(`/konto/einstellungen?error=${encodeURIComponent("Bitte melde dich erneut an und starte die Kontolöschung innerhalb von zehn Minuten.")}`);
  }

  const admin = createSupabaseAdminClient();
  const requestedIso = new Date(request.requestedAt).toISOString();
  const { error: enqueueError } = await admin.from("account_deletion_jobs").insert({
    deletion_request_id: request.deletionRequestId,
    account_id: request.accountId,
    status: request.status,
    requested_at: requestedIso,
    attempt_count: request.attemptCount,
    lease_until: null,
    completed_at: null,
    last_error_code: null
  });
  if (enqueueError) {
    redirect(`/konto/einstellungen?error=${encodeURIComponent("Die Kontolöschung konnte nicht sicher vorbereitet werden.")}`);
  }

  const leaseUntil = new Date(requestedAt + 10 * 60 * 1000).toISOString();
  const { error: claimError } = await admin.from("account_deletion_jobs").update({
    status: "processing",
    attempt_count: 1,
    lease_until: leaseUntil,
    updated_at: requestedIso
  }).eq("deletion_request_id", request.deletionRequestId);
  if (claimError) {
    await markDeletionFailed(request.deletionRequestId, "claim_failed");
    redirect(`/konto/einstellungen?error=${encodeURIComponent("Die Kontolöschung konnte nicht gestartet werden.")}`);
  }

  await supabase.auth.signOut({ scope: "global" });
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(context.user.id);
  if (authDeleteError) {
    await markDeletionFailed(request.deletionRequestId, "auth_delete_failed");
    redirect(`/anmelden?error=${encodeURIComponent("Die Kontolöschung ist fehlgeschlagen. Bitte melde dich erneut an und versuche es noch einmal.")}`);
  }

  const { error: accountDeleteError } = await admin.from("accounts").delete()
    .eq("account_id", context.identity.account.accountId);
  if (accountDeleteError) {
    await markDeletionFailed(request.deletionRequestId, "account_delete_failed");
    redirect(`/anmelden?error=${encodeURIComponent("Die Anmeldung wurde entfernt, aber die Datenbereinigung muss administrativ abgeschlossen werden.")}`);
  }

  const completedIso = new Date().toISOString();
  await admin.from("account_deletion_jobs").update({
    status: "completed",
    account_id: null,
    lease_until: null,
    completed_at: completedIso,
    last_error_code: null,
    updated_at: completedIso
  }).eq("deletion_request_id", request.deletionRequestId);

  redirect(`/anmelden?message=${encodeURIComponent("Dein Konto und deine personenbezogenen Spieldaten wurden gelöscht.")}&returnTo=%2F`);
}
