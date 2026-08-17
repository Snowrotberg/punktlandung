import { InMemoryAccountIdentityRepository } from "../lib/accountIdentity";
import { accountIdentityRepositoryContract } from "./contracts/account-identity-repository.contract";

accountIdentityRepositoryContract("in-memory account identity repository", () => new InMemoryAccountIdentityRepository());
