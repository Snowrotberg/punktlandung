import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  safeNextPath
} from "@/lib/accessGate";

export const runtime = "nodejs";

function accessToken(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function accessPageUrl(request: NextRequest, nextPath: string) {
  const url = new URL("/zugang", request.url);
  url.searchParams.set("error", "1");

  if (nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  }

  return url;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const submittedPassword = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));
  const password = process.env.APP_ACCESS_PASSWORD?.trim();

  if (!password) {
    return NextResponse.redirect(new URL(nextPath, request.url), 303);
  }

  if (submittedPassword !== password) {
    return NextResponse.redirect(accessPageUrl(request, nextPath), 303);
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: nextPath
    }
  });

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: accessToken(password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/"
  });

  return response;
}
