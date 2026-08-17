import { createRankedGameHttpApi, rankedModeEnabled, rankedUnavailableResponse } from "@/lib/rankedGameRuntime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ gameId: string; roundId: string }> }) {
  if (!rankedModeEnabled()) return rankedUnavailableResponse();
  const { gameId, roundId } = await context.params;
  return createRankedGameHttpApi(request).ready(request, gameId, roundId);
}
