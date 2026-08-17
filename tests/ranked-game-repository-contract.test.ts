import { InMemoryRankedGameRepository } from "../lib/rankedGameRepository";
import { rankedGameRepositoryContract } from "./contracts/ranked-game-repository.contract";

rankedGameRepositoryContract("in-memory ranked game repository", () => new InMemoryRankedGameRepository());
