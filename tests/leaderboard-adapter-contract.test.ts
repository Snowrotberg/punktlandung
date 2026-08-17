import { InMemoryLeaderboardProjectionRepository, LeaderboardProjectionService } from "../lib/leaderboardProjectionRepository";
import type { LeaderboardGameResult } from "../lib/leaderboards";
import { leaderboardAdapterContract } from "./contracts/leaderboard-adapter.contract";

leaderboardAdapterContract("in-memory leaderboard adapter", () => {
  let games: LeaderboardGameResult[] = [];
  const service = new LeaderboardProjectionService(new InMemoryLeaderboardProjectionRepository());
  return {
    setGames: async (next) => { games = structuredClone(next); },
    rebuild: async (query, now) => { await service.rebuild(games, query, now); },
    read: async (query) => (await service.read(query))?.entries ?? []
  };
});
