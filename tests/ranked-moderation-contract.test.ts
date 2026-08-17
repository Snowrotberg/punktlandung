import { InMemoryRankedGameRepository } from "../lib/rankedGameRepository";
import { InMemoryRankedModerationRepository } from "../lib/rankedModeration";
import { rankedModerationContract } from "./contracts/ranked-moderation.contract";

rankedModerationContract("in-memory ranked moderation adapter", () => {
  const games = new InMemoryRankedGameRepository();
  return { games, moderation: new InMemoryRankedModerationRepository(games) };
});
