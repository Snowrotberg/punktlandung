import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import { securityHeaders } from "@/lib/securityHeaders";

const canonicalSiteUrl = new URL(siteUrl);

function hostnameFromHeader(value: string | null): string | null {
  const firstValue = value?.split(",", 1)[0]?.trim();
  if (!firstValue) return null;

  try {
    return new URL(`http://${firstValue}`).hostname;
  } catch {
    return null;
  }
}

export function canonicalRedirectUrl(requestUrl: URL, requestHostname = requestUrl.hostname): URL | null {
  if (requestHostname !== `www.${canonicalSiteUrl.hostname}`) return null;

  const canonicalUrl = new URL(requestUrl);
  canonicalUrl.protocol = canonicalSiteUrl.protocol;
  canonicalUrl.hostname = canonicalSiteUrl.hostname;
  canonicalUrl.port = canonicalSiteUrl.port;
  return canonicalUrl;
}

export async function middleware(request: NextRequest) {
  const requestHostname =
    hostnameFromHeader(request.headers.get("x-forwarded-host")) ??
    hostnameFromHeader(request.headers.get("host")) ??
    request.nextUrl.hostname;
  const canonicalUrl = canonicalRedirectUrl(request.nextUrl, requestHostname);
  if (canonicalUrl) {
    const response = NextResponse.redirect(canonicalUrl, 308);
    securityHeaders().forEach(([name, value]) => response.headers.set(name, value));
    return response;
  }

  const response = await updateSupabaseSession(request);
  securityHeaders().forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
