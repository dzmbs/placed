import assert from 'node:assert/strict';
import test from 'node:test';
import { ReadCache } from '../src/lib/marketplace/read-cache';

test('a read burst shares work, separate wallets stay isolated, and expiry refreshes', async () => {
  let now = 0,
    calls = 0;
  const cache = new ReadCache(10, () => now);
  const load = async () => ++calls;
  const values = await Promise.all(
    Array.from({ length: 50 }, () => cache.read('public:block1', load, 100)),
  );
  assert.deepEqual(new Set(values), new Set([1]));
  await Promise.all([cache.read('wallet:A:block1', load), cache.read('wallet:B:block1', load)]);
  assert.equal(calls, 3);
  now = 101;
  assert.equal(await cache.read('public:block1', load), 4);
  assert.equal(await cache.read('public:block2', load), 5);
});
test('failures back off without returning stale success and recover after cooldown', async () => {
  let now = 0,
    calls = 0;
  const cache = new ReadCache(10, () => now);
  const load = async () => {
    calls++;
    throw new Error('RPC rate limit');
  };
  const burst = await Promise.allSettled(
    Array.from({ length: 20 }, () => cache.read('head', load, 100, 30)),
  );
  assert.ok(burst.every((value) => value.status === 'rejected'));
  assert.equal(calls, 1);
  await assert.rejects(cache.read('head', load), /RPC rate limit/);
  assert.equal(calls, 1);
  now = 31;
  assert.equal(await cache.read('head', async () => ++calls), 2);
});
