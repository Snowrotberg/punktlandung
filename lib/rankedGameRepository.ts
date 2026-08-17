import type { RankedGame } from "./rankedGame";

/**
 * Atomic persistence port. Firebase and Supabase adapters must implement the
 * same compare-and-swap semantics so domain retries cannot duplicate guesses,
 * completions or claims.
 */
export interface RankedGameRepository {
  findById(gameId: string): Promise<RankedGame | null>;
  findByCreateRequest(createRequestId: string): Promise<RankedGame | null>;
  findLatestActiveByGuestIdHash(guestIdHash: string): Promise<RankedGame | null>;
  create(game: RankedGame): Promise<RankedGame>;
  updateAtomically(
    gameId: string,
    transform: (current: RankedGame) => RankedGame
  ): Promise<RankedGame>;
  deleteExpiredUnclaimed(now: number, limit: number): Promise<number>;
}

export class InMemoryRankedGameRepository implements RankedGameRepository {
  private readonly games = new Map<string, RankedGame>();
  private readonly createRequests = new Map<string, string>();

  async findById(gameId: string): Promise<RankedGame | null> {
    const game = this.games.get(gameId);
    return game ? structuredClone(game) : null;
  }

  async findByCreateRequest(createRequestId: string): Promise<RankedGame | null> {
    const gameId = this.createRequests.get(createRequestId);
    const game = gameId ? this.games.get(gameId) : null;
    return game ? structuredClone(game) : null;
  }

  async findLatestActiveByGuestIdHash(guestIdHash: string): Promise<RankedGame | null> {
    const game = Array.from(this.games.values())
      .filter((candidate) => candidate.guestIdHash === guestIdHash && candidate.status === "active")
      .sort((left, right) => right.startedAt - left.startedAt)[0];
    return game ? structuredClone(game) : null;
  }

  async create(game: RankedGame): Promise<RankedGame> {
    const byRequest = await this.findByCreateRequest(game.createRequestId);
    if (byRequest) return byRequest;
    const byId = await this.findById(game.gameId);
    if (byId) throw new Error(`Ranked game ${game.gameId} already exists.`);
    const stored = structuredClone(game);
    this.games.set(game.gameId, stored);
    this.createRequests.set(game.createRequestId, game.gameId);
    return structuredClone(stored);
  }

  async updateAtomically(gameId: string, transform: (current: RankedGame) => RankedGame): Promise<RankedGame> {
    const current = this.games.get(gameId);
    if (!current) throw new Error(`Ranked game ${gameId} does not exist.`);
    const next = transform(structuredClone(current));
    if (next.gameId !== current.gameId || next.createRequestId !== current.createRequestId) {
      throw new Error("Atomic updates cannot replace ranked game identity.");
    }
    const stored = structuredClone(next);
    this.games.set(gameId, stored);
    return structuredClone(stored);
  }

  async deleteExpiredUnclaimed(now: number, limit: number): Promise<number> {
    if (!Number.isFinite(now) || !Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("Guest cleanup parameters are invalid.");
    }
    const expired = Array.from(this.games.values())
      .filter((game) => game.accountId === null && game.guestExpiresAt !== null && game.guestExpiresAt <= now)
      .sort((left, right) => (left.guestExpiresAt as number) - (right.guestExpiresAt as number))
      .slice(0, limit);
    for (const game of expired) {
      this.games.delete(game.gameId);
      this.createRequests.delete(game.createRequestId);
    }
    return expired.length;
  }
}
