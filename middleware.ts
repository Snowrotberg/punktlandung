import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, isAccessPublicPath } from "@/lib/accessGate";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const password = process.env.APP_ACCESS_PASSWORD?.trim();

  if (!password) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (isAccessPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (token === (await sha256(password))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/zugang";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
