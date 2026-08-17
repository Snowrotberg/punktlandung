import { InMemoryAccountDeletionOutbox } from "../lib/accountDataLifecycle";
import { accountDeletionOutboxContract } from "./contracts/account-deletion-outbox.contract";

accountDeletionOutboxContract("in-memory account deletion outbox", () => new InMemoryAccountDeletionOutbox());
