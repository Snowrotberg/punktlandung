import assert from "node:assert/strict";
import test from "node:test";
import { AccountDeletionWorker, InMemoryAccountDeletionOutbox, createAccountDeletionRequest } from "../lib/accountDataLifecycle";

function request(id: string) {
  return createAccountDeletionRequest({
    deletionRequestId: id,
    accountId: "account-0001",
    requestedAt: 10_000,
    reauthenticatedAt: 9_000
  });
}

test("deletion worker executes one durable job and then becomes idle", async () => {
  const outbox = new InMemoryAccountDeletionOutbox();
  await outbox.enqueue(request("delete-request-0001"));
  const erased: string[] = [];
  const worker = new AccountDeletionWorker(outbox, { erase: async (accountId) => { erased.push(accountId); } });
  assert.equal(await worker.runNext(20_000), true);
  assert.deepEqual(erased, ["account-0001"]);
  assert.equal(await worker.runNext(20_001), false);
});

test("deletion worker records generic retryable failure without leaking exception text", async () => {
  const outbox = new InMemoryAccountDeletionOutbox();
  await outbox.enqueue(request("delete-request-0001"));
  const worker = new AccountDeletionWorker(outbox, { erase: async () => { throw new Error("secret provider response"); } });
  assert.equal(await worker.runNext(20_000), true);
  const failed = await outbox.findById("delete-request-0001");
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.lastErrorCode, "execution_failed");
  assert.equal(JSON.stringify(failed).includes("secret provider response"), false);
  const retried = await outbox.claimNext(20_001, 1_000);
  assert.equal(retried?.lastErrorCode, null);
  assert.equal(retried?.attemptCount, 2);
});
