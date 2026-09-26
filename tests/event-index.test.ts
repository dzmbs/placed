import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EventIndex, type IndexedLog } from '../src/lib/marketplace/event-index';

const log = (blockNumber: bigint, fork = 'a', logIndex = 0) => ({
  blockNumber,
  blockHash: `${fork}:${blockNumber}`,
  transactionHash: `${fork}:tx:${blockNumber}`,
  logIndex,
  args: { amount: 12345678901234567890n },
});
test('persisted cursors survive indexer restarts and only fetch new blocks', async () => {
  const db = new DatabaseSync(':memory:');
  const ranges: [bigint, bigint][] = [];
  const load = async (from: bigint, to: bigint) => {
    ranges.push([from, to]);
    return [log(to)];
  };
  const hash = async (block: bigint) => `a:${block}`;
  const first = new EventIndex(db, [500n]);
  await first.read('auction', 100n, 1100n, load, hash);
  assert.equal(ranges.length, 3);
  ranges.length = 0;
  const restarted = new EventIndex(db, [500n]);
  const events = await restarted.read('auction', 100n, 1102n, load, hash);
  assert.deepEqual(ranges, [[1101n, 1102n]]);
  assert.equal(events.length, 4);
  assert.equal(events[0].args.amount, 12345678901234567890n);
  await restarted.read('auction', 100n, 1102n, load, hash);
  assert.equal(ranges.length, 1);
  await restarted.read('auction', 100n, 1100n, load, hash);
  assert.equal(ranges.length, 1);
  assert.equal(
    (db.prepare('SELECT block FROM chain_cursors').get() as { block: number }).block,
    1102,
  );
  db.close();
});
test('all wallets share one sync and a newer waiting caller advances the cursor', async () => {
  const db = new DatabaseSync(':memory:');
  const index = new EventIndex(db, [500n]);
  const ranges: [bigint, bigint][] = [];
  const load = async (from: bigint, to: bigint) => {
    ranges.push([from, to]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return [log(to)];
  };
  const hash = async (block: bigint) => `a:${block}`;
  const [a, b, c] = await Promise.all([
    index.read('shared', 1n, 10n, load, hash),
    index.read('shared', 1n, 10n, load, hash),
    index.read('shared', 1n, 12n, load, hash),
  ]);
  assert.deepEqual(ranges, [
    [1n, 10n],
    [11n, 12n],
  ]);
  assert.deepEqual(a, b);
  assert.equal(c.length, 2);
  db.close();
});
test('a failed chunk does not publish partial history or advance the cursor', async () => {
  const db = new DatabaseSync(':memory:');
  const index = new EventIndex(db, [500n]);
  const hash = async (block: bigint) => `a:${block}`;
  await index.read('shared', 0n, 9n, async (_, to) => [log(to)], hash);
  await assert.rejects(
    index.read(
      'shared',
      0n,
      1009n,
      async (from, to) => {
        if (from === 510n) throw new Error('Rate limited');
        return [log(to)];
      },
      hash,
    ),
    /Rate limited/,
  );
  assert.equal((db.prepare('SELECT block FROM chain_cursors').get() as { block: number }).block, 9);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM chain_events').get() as { n: number }).n, 1);
  db.close();
});
test('a reorg removes discarded bids rather than duplicating them', async () => {
  const db = new DatabaseSync(':memory:');
  const index = new EventIndex(db, [500n]);
  await index.read(
    'shared',
    1n,
    10n,
    async () => [log(7n)],
    async (block) => `a:${block}`,
  );
  const rebuilt = await index.read(
    'shared',
    1n,
    11n,
    async () => [log(8n, 'b')],
    async (block) => `b:${block}`,
  );
  assert.deepEqual(
    rebuilt.map((event: IndexedLog) => event.transactionHash),
    ['b:tx:8'],
  );
  db.close();
});
