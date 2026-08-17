import { NextResponse } from "next/server";
import { safeAuthOrigin, safeAuthReturnPath } from "@/lib/authNavigation";
import { siteUrl } from "@/lib/seo";
import { resolveSupabaseAccount, supabaseAccountsEnabled } from "@/lib/supabase/auth.server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeAuthReturnPath(url.searchParams.get("returnTo"));
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? (forwardedHost?.startsWith("localhost") || forwardedHost?.startsWith("127.0.0.1") ? "http" : "https");
  const requestOrigin = safeAuthOrigin(forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : url.origin, siteUrl);
  const errorUrl = new URL("/anmelden", requestOrigin);
  errorUrl.searchParams.set("returnTo", returnTo);

  if (!supabaseAccountsEnabled()) {
    errorUrl.searchParams.set("error", "Die Anmeldung ist noch nicht freigeschaltet.");
    return NextResponse.redirect(errorUrl);
  }

  if (url.searchParams.has("error")) {
    errorUrl.searchParams.set("error", "Die Anmeldung wurde abgebrochen oder konnte nicht abgeschlossen werden.");
    return NextResponse.redirect(errorUrl);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    errorUrl.searchParams.set("error", "Der Anmeldelink ist ungültig oder abgelaufen.");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    errorUrl.searchParams.set("error", "Die Anmeldung konnte nicht abgeschlossen werden.");
    return NextResponse.redirect(errorUrl);
  }

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    errorUrl.searchParams.set("error", "Die Anmeldung konnte nicht bestätigt werden.");
    return NextResponse.redirect(errorUrl);
  }

  await resolveSupabaseAccount(data.user);
  return NextResponse.redirect(new URL(returnTo === "/" ? "/konto" : returnTo, requestOrigin));
}
