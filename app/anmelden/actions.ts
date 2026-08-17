"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeAuthOrigin, safeAuthReturnPath, webAuthCallbackUrl } from "@/lib/authNavigation";
import { siteUrl } from "@/lib/seo";
import { googleLoginEnabled, resolveSupabaseAccount, supabaseAccountsEnabled } from "@/lib/supabase/auth.server";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function loginUrl(kind: "error" | "message", value: string, returnTo: string): string {
  const params = new URLSearchParams({ [kind]: value, returnTo });
  return `/anmelden?${params.toString()}`;
}

function credentials(formData: FormData): { email: string; password: string; returnTo: string } {
  const email = field(formData, "email").toLocaleLowerCase("de-DE");
  const password = field(formData, "password");
  const returnTo = safeAuthReturnPath(field(formData, "returnTo"));
  if (!email || email.length > 254 || !email.includes("@") || password.length < 8 || password.length > 128) {
    redirect(loginUrl("error", "Bitte prüfe E-Mail-Adresse und Passwort.", returnTo));
  }
  return { email, password, returnTo };
}

function assertEnabled(returnTo: string): void {
  if (!supabaseAccountsEnabled()) {
    redirect(loginUrl("error", "Die Anmeldung ist noch nicht freigeschaltet.", returnTo));
  }
}

async function currentAuthOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const explicitOrigin = requestHeaders.get("origin");
  if (explicitOrigin) return safeAuthOrigin(explicitOrigin, siteUrl);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  return safeAuthOrigin(host ? `${protocol}://${host}` : null, siteUrl);
}

export async function signIn(formData: FormData): Promise<void> {
  const { email, password, returnTo } = credentials(formData);
  assertEnabled(returnTo);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(loginUrl("error", "Anmeldung nicht möglich. Bitte prüfe E-Mail-Adresse und Passwort.", returnTo));
  }
  await resolveSupabaseAccount(data.user, "email");
  redirect(returnTo === "/" ? "/konto" : returnTo);
}

export async function signUp(formData: FormData): Promise<void> {
  const { email, password, returnTo } = credentials(formData);
  assertEnabled(returnTo);
  const authOrigin = await currentAuthOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: webAuthCallbackUrl(authOrigin, returnTo === "/" ? "/konto" : returnTo)
    }
  });
  if (error || !data.user) {
    redirect(loginUrl("error", "Das Konto konnte nicht angelegt werden. Vielleicht existiert es bereits.", returnTo));
  }
  if (data.session) {
    await resolveSupabaseAccount(data.user, "email");
    redirect(returnTo === "/" ? "/konto" : returnTo);
  }
  redirect(loginUrl("message", "Fast geschafft: Bitte bestätige jetzt den Link in deiner E-Mail.", returnTo));
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const returnTo = safeAuthReturnPath(field(formData, "returnTo"));
  assertEnabled(returnTo);
  if (!googleLoginEnabled()) {
    redirect(loginUrl("error", "Google-Login wird gerade noch eingerichtet.", returnTo));
  }
  const authOrigin = await currentAuthOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: webAuthCallbackUrl(authOrigin, returnTo === "/" ? "/konto" : returnTo),
      queryParams: { prompt: "select_account" }
    }
  });
  if (error || !data.url) {
    redirect(loginUrl("error", "Google-Login konnte nicht gestartet werden.", returnTo));
  }
  redirect(data.url);
}
