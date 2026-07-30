import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo";

const canonicalSiteUrl = new URL(siteUrl);

export function canonicalRedirectUrl(requestUrl: URL): URL | null {
  if (requestUrl.hostname !== `www.${canonicalSiteUrl.hostname}`) return null;

  const canonicalUrl = new URL(requestUrl);
  canonicalUrl.protocol = canonicalSiteUrl.protocol;
  canonicalUrl.hostname = canonicalSiteUrl.hostname;
  canonicalUrl.port = canonicalSiteUrl.port;
  return canonicalUrl;
}

export function middleware(request: NextRequest) {
  const canonicalUrl = canonicalRedirectUrl(request.nextUrl);
  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
