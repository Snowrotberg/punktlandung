import { NextResponse } from "next/server";
import { getAdminAccountContext } from "@/lib/adminAccess.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = Boolean(await getAdminAccountContext());
  return NextResponse.json(
    { admin },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
