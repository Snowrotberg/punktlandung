import { createRankedGameHttpApi } from "@/lib/rankedGameRuntime.server";

export async function POST(request: Request, context: { params: Promise<{ gameId: string; roundId: string }> }) {
  const { gameId, roundId } = await context.params;
  return createRankedGameHttpApi(request).reroll(request, gameId, roundId);
}
