import { createRankedGameHttpApi, rankedModeEnabled, rankedUnavailableResponse } from "@/lib/rankedGameRuntime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  if (!rankedModeEnabled()) return rankedUnavailableResponse();
  const { gameId } = await context.params;
  return createRankedGameHttpApi(request).get(request, gameId);
}
