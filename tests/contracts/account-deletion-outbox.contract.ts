import assert from "node:assert/strict";
import test from "node:test";
import { AccountLifecycleError, createAccountDeletionRequest, type AccountDeletionOutbox } from "../../lib/accountDataLifecycle";

export type AccountDeletionOutboxFactory = () => Promise<AccountDeletionOutbox> | AccountDeletionOutbox;

function request(id = "delete-request-0001", accountId = "account-0001") {
  return createAccountDeletionRequest({
    deletionRequestId: id,
    accountId,
    requestedAt: 10_000,
    reauthenticatedAt: 9_000
  });
}

/** Register unchanged for the durable Supabase and Firebase deletion adapters. */
export function accountDeletionOutboxContract(label: string, factory: AccountDeletionOutboxFactory): void {
  test(`${label}: enqueue is idempotent but cannot cross account ownership`, async () => {
    const outbox = await factory();
    const first = await outbox.enqueue(request());
    assert.deepEqual(await outbox.enqueue(request()), first);
    await assert.rejects(
      outbox.enqueue(request("delete-request-0001", "account-0002")),
      (error: unknown) => error instanceof AccountLifecycleError && error.code === "identity_mismatch"
    );
  });

  test(`${label}: concurrent workers cannot claim the same live lease`, async () => {
    const outbox = await factory();
    await outbox.enqueue(request());
    const claims = await Promise.all([outbox.claimNext(20_000, 60_000), outbox.claimNext(20_000, 60_000)]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(claims.find(Boolean)?.attemptCount, 1);
  });

  test(`${label}: expired leases and failed jobs are retryable`, async () => {
    const outbox = await factory();
    await outbox.enqueue(request());
    await outbox.claimNext(20_000, 1_000);
    assert.equal(await outbox.claimNext(20_999, 1_000), null);
    const reclaimed = await outbox.claimNext(21_000, 1_000);
    assert.equal(reclaimed?.attemptCount, 2);
    if (!reclaimed) throw new Error("missing reclaimed job");
    const failed = await outbox.fail(reclaimed.deletionRequestId, "provider_timeout", 21_001);
    assert.equal(failed.status, "failed");
    assert.equal((await outbox.claimNext(21_002, 1_000))?.attemptCount, 3);
  });

  test(`${label}: completion is idempotent, removes account ID and prevents reprocessing`, async () => {
    const outbox = await factory();
    await outbox.enqueue(request());
    const processing = await outbox.claimNext(20_000, 60_000);
    if (!processing) throw new Error("missing processing job");
    const completed = await outbox.complete(processing.deletionRequestId, 20_100);
    assert.equal(completed.status, "completed");
    assert.equal(completed.accountId, null);
    assert.equal(completed.completedAt, 20_100);
    assert.deepEqual(await outbox.complete(processing.deletionRequestId, 30_000), completed);
    assert.equal(await outbox.claimNext(30_000, 60_000), null);
  });
}
