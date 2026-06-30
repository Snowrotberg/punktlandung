import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  accessRedirectUrl,
  getAccessPasswords,
  isAccessPublicPath
} from "@/lib/accessGate";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function accessPagePath(nextPath: string) {
  const url = new URL("/zugang", "https://punktlandung.local");
  url.searchParams.set("next", nextPath);

  return `${url.pathname}${url.search}`;
}

export async function middleware(request: NextRequest) {
  const accessPasswords = getAccessPasswords();

  if (accessPasswords.length === 0) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (isAccessPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const accessTokens = await Promise.all(accessPasswords.map(sha256));

  if (token && accessTokens.includes(token)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(
    accessRedirectUrl(
      accessPagePath(`${pathname}${search}`),
      request.headers,
      request.nextUrl.origin
    )
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
