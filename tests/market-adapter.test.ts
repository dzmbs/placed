import assert from 'node:assert/strict';
import test from 'node:test';
import type { EIP1193Provider } from 'viem';
import { createMarketAdapter, type MarketWallet } from '../src/lib/marketplace/market-adapter';
import { ConfirmedActionRefreshError, friendlyMarketError } from '../src/lib/marketplace/progress';
import * as chain from '../src/lib/marketplace/client';
import type { MarketSnapshot } from '../src/lib/marketplace/snapshot';

const address = '0x1111111111111111111111111111111111111111';
const hash = `0x${'1'.repeat(64)}`;
const wallet: MarketWallet = {
  address: () => address,
  provider: async () =>
    ({
      request: async () => '0xaa36a7',
      on: () => {},
      removeListener: () => {},
    }) as EIP1193Provider,
  connect: async () => {},
  disconnect: async () => {},
  switchNetwork: async () => {},
  verify: async () => {},
  authenticate: async () => {
    throw new Error('Not needed for the faucet');
  },
  session: () => undefined,
};
function snapshot(): MarketSnapshot {
  return {
    assets: [],
    campaigns: [],
    launches: {},
    events: [],
    now: Date.now(),
    wallet: {
      address,
      usdc: '10000000000',
      credit: '0',
      authorized: false,
      admin: false,
      approvals: {},
      tokens: {},
    },
  };
}

test('a confirmed faucet survives failed refreshes and retry never mints a second time', async () => {
  let mints = 0,
    refreshFails = false;
  const adapter = createMarketAdapter(wallet, {
    ...chain,
    api: async <T>() => {
      if (refreshFails) throw new Error('Backend unavailable');
      return snapshot() as T;
    },
    faucet: async () => {
      mints++;
      refreshFails = true;
      return { transactionHash: hash } as Awaited<ReturnType<typeof chain.faucet>>;
    },
  });
  await assert.rejects(adapter.execute({ type: 'faucet' }, address), (error: unknown) => {
    assert.ok(error instanceof ConfirmedActionRefreshError);
    assert.equal(error.hash, hash);
    assert.match(friendlyMarketError(error), /action completed/);
    return true;
  });
  await assert.rejects(adapter.execute({ type: 'faucet' }, address), /Backend unavailable/);
  assert.equal(mints, 1);
  refreshFails = false;
  const result = await adapter.execute({ type: 'faucet' }, address);
  assert.equal(mints, 1);
  assert.equal(result.state.people[0].usdc, 10_000_000_000);
  assert.equal(result.state.receipts[0].id, hash);
  // After recovering, a new deliberate faucet request is a separate action.
  await assert.rejects(adapter.execute({ type: 'faucet' }, address), ConfirmedActionRefreshError);
  assert.equal(mints, 2);
});

test('a rejected faucet is never reported as confirmed', async () => {
  const rejected = { code: 4001, message: 'User rejected' };
  const adapter = createMarketAdapter(wallet, {
    ...chain,
    api: async <T>() => snapshot() as T,
    faucet: async () => {
      throw rejected;
    },
  });
  await assert.rejects(adapter.execute({ type: 'faucet' }, address), (error: unknown) => {
    assert.equal(error, rejected);
    assert.equal(error instanceof ConfirmedActionRefreshError, false);
    return true;
  });
});

test('post-confirmation refresh includes the receipt block and keeps it for later reads', async () => {
  const paths: string[] = [];
  const adapter = createMarketAdapter(wallet, {
    ...chain,
    api: async <T>(path: string) => {
      paths.push(path);
      return snapshot() as T;
    },
    faucet: async () =>
      ({ transactionHash: hash, blockNumber: 123n }) as Awaited<ReturnType<typeof chain.faucet>>,
  });
  await adapter.execute({ type: 'faucet' }, address);
  assert.ok(!paths[0].includes('minimumBlock'));
  assert.equal(new URL(paths.at(-1)!, 'http://test').searchParams.get('minimumBlock'), '123');
  await adapter.getState();
  assert.equal(new URL(paths.at(-1)!, 'http://test').searchParams.get('minimumBlock'), '123');
});
