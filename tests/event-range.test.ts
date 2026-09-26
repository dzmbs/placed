import assert from 'node:assert/strict';
import test from 'node:test';
import { readEventRange } from '../src/lib/marketplace/event-range';

test('deployment scans cover every block once within public RPC range limits', async () => {
  const ranges: [bigint, bigint][] = [];
  const logs = await readEventRange(100n, 1239n, async (from, to) => {
    assert.ok(to - from + 1n <= 500n);
    ranges.push([from, to]);
    return [from, to];
  });
  assert.deepEqual(ranges, [
    [100n, 599n],
    [600n, 1099n],
    [1100n, 1239n],
  ]);
  assert.deepEqual(logs, ranges.flat());
});

test('single-block scans are inclusive and future ranges make no requests', async () => {
  let calls = 0;
  const read = async (from: bigint, to: bigint) => {
    calls++;
    return [from, to];
  };
  assert.deepEqual(await readEventRange(9n, 9n, read), [9n, 9n]);
  assert.deepEqual(await readEventRange(10n, 9n, read), []);
  assert.equal(calls, 1);
});

test('a failed chunk rejects the scan rather than returning incomplete activity', async () => {
  await assert.rejects(
    readEventRange(0n, 1000n, async (from) => {
      if (from === 500n) throw new Error('RPC unavailable');
      return [from];
    }),
    /RPC unavailable/,
  );
});
