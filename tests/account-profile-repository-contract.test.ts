import { InMemoryAccountProfileRepository } from "../lib/accountProfileRepository";
import { accountProfileRepositoryContract } from "./contracts/account-profile-repository.contract";

accountProfileRepositoryContract("in-memory account profile repository", () => new InMemoryAccountProfileRepository());
