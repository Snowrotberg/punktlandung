import { createRankedGameHttpApi, rankedModeEnabled, rankedUnavailableResponse } from "@/lib/rankedGameRuntime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rankedModeEnabled()) return rankedUnavailableResponse();
  return createRankedGameHttpApi(request).start(request);
}
