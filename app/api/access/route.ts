import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  accessRedirectUrl,
  getAccessPasswords,
  safeNextPath
} from "@/lib/accessGate";

export const runtime = "nodejs";

function accessToken(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function accessPagePath(nextPath: string) {
  const url = new URL("/zugang", "https://punktlandung.local");
  url.searchParams.set("error", "1");

  if (nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  }

  return `${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const submittedPassword = String(formData.get("password") ?? "").trim();
  const nextPath = safeNextPath(formData.get("next"));
  const redirectUrl = (path: string) =>
    accessRedirectUrl(path, request.headers, request.nextUrl.origin);
  const accessPasswords = getAccessPasswords();
  const password = accessPasswords.find(
    (accessPassword) => submittedPassword === accessPassword
  );

  if (accessPasswords.length === 0) {
    return NextResponse.redirect(redirectUrl(nextPath), 303);
  }

  if (!password) {
    return NextResponse.redirect(redirectUrl(accessPagePath(nextPath)), 303);
  }

  const response = NextResponse.redirect(redirectUrl(nextPath), 303);

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
