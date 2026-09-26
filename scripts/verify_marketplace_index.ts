// Read-only chain verification. Writes only the local SQLite read index.
// Run with: node --env-file=.env.local --conditions=react-server --import tsx scripts/verify_marketplace_index.ts
import assert from 'node:assert/strict';
import type { Address } from 'viem';

async function main() {
  const fetchOriginal = globalThis.fetch;
  const methods: string[] = [];
  const ranges: [bigint, bigint][] = [];
  globalThis.fetch = async (input, init) => {
    const current: { method: string; range?: string }[] = [];
    if (typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        for (const call of Array.isArray(body) ? body : [body]) {
          if (call.jsonrpc !== '2.0' || typeof call.method !== 'string') continue;
          methods.push(call.method);
          current.push({
            method: call.method,
            range:
              call.method === 'eth_getLogs'
                ? `${call.params[0].fromBlock}..${call.params[0].toBlock}`
                : undefined,
          });
          if (call.method === 'eth_getLogs')
            ranges.push([BigInt(call.params[0].fromBlock), BigInt(call.params[0].toBlock)]);
        }
      } catch {
        /* Non-RPC requests are outside this measurement. */
      }
    }
    const response = await fetchOriginal(input, init);
    if (current.length) {
      const data = await response
        .clone()
        .json()
        .catch(() => null);
      for (const [i, result] of (Array.isArray(data) ? data : [data]).entries())
        if (result?.error)
          console.error(
            'RPC read rejected:',
            current[i]?.method,
            current[i]?.range ?? '',
            'code',
            result.error.code,
          );
    }
    return response;
  };
  try {
    const { latestBlock } = await import('../src/lib/marketplace/server/chain');
    const { marketSnapshot } = await import('../src/lib/marketplace/server/snapshot');
    const block = await latestBlock();
    const publicState = await marketSnapshot(block);
    const cold = methods.length;
    methods.length = 0;
    const wallets = [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ] as Address[];
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => marketSnapshot(block, wallets[i % 2])),
    );
    const burst = methods.length;
    assert.ok(results.every((state, i) => state.wallet?.address === wallets[i % 2]));
    assert.equal(
      publicState.wallet,
      undefined,
      'Wallet state must not leak into the shared snapshot',
    );
    assert.equal(
      methods.filter((name) => name === 'eth_getLogs').length,
      0,
      'Wallet changes must not rescan market history',
    );
    assert.ok(
      burst < 12 + publicState.assets.filter((asset) => asset.financing).length * 8,
      'Repeated wallet reads must coalesce instead of making fifty sets of chain reads',
    );
    methods.length = 0;
    await Promise.all(wallets.map((wallet) => marketSnapshot(block, wallet)));
    assert.equal(methods.length, 0, 'Warm reads at the same block must make no RPC calls');
    assert.ok(ranges.every(([from, to]) => to - from < 500n));
    console.log(
      `Passed: ${publicState.assets.length} assets, ${publicState.campaigns.length} campaigns; initial read ${cold} RPC calls; 50 reads across two wallets ${burst} RPC calls; repeated warm reads 0. All event ranges <=500 blocks.`,
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}
main().catch((error: unknown) => {
  console.error(
    'Market index verification failed. No transactions were submitted.',
    error instanceof assert.AssertionError
      ? error.message
      : error instanceof Error
        ? error.name
        : 'Unknown failure',
  );
  process.exitCode = 1;
});
