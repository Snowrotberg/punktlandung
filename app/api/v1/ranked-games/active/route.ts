import { createRankedGameHttpApi, rankedModeEnabled, rankedUnavailableResponse } from "@/lib/rankedGameRuntime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!rankedModeEnabled()) return rankedUnavailableResponse();
  return createRankedGameHttpApi(request).recoverLatest(request);
}
