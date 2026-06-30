import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  getAccessPasswords,
  safeNextPath
} from "@/lib/accessGate";

export const runtime = "nodejs";

function accessToken(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function redirectResponse(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location
    }
  });
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
  const accessPasswords = getAccessPasswords();
  const password = accessPasswords.find(
    (accessPassword) => submittedPassword === accessPassword
  );

  if (accessPasswords.length === 0) {
    return redirectResponse(nextPath);
  }

  if (!password) {
    return redirectResponse(accessPagePath(nextPath));
  }

  const response = redirectResponse(nextPath);

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
