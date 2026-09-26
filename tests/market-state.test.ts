import assert from 'node:assert/strict';
import test from 'node:test';
import { mapMarketState, uiAmount } from '../src/lib/marketplace/market-state';
import { friendlyMarketError } from '../src/lib/marketplace/progress';
import { redemptionReady } from '../src/lib/market';
import { initialDraft } from '../src/lib/studio';
import type { MarketSnapshot } from '../src/lib/marketplace/snapshot';

const owner = '0x1111111111111111111111111111111111111111';
const brand = '0x2222222222222222222222222222222222222222';
const token = '0x3333333333333333333333333333333333333333';
function fixture(): MarketSnapshot {
  const slot = initialDraft().spots[0];
  return {
    now: 1_000_000,
    launches: {},
    events: [],
    campaigns: [],
    assets: [
      {
        id: '1',
        creator: { wallet: owner },
        metadataURI: '/metadata/1',
        ensName: 'a1.placed.eth',
        metadata: {
          version: 1,
          title: 'Shirt',
          description: 'Reusable shirt',
          kind: 'dress',
          color: '#fff',
          photos: [],
        },
        slots: ['1', '2'].map((id) => ({
          id,
          assetId: '1',
          metadataURI: `/metadata/${id}`,
          ensName: `s${id}.a1.placed.eth`,
          resolver: token,
          dnsName: '0x00',
          metadata: { version: 1, name: `Panel ${id}`, placement: { ...slot, id } },
        })),
      },
    ],
    wallet: {
      address: owner,
      usdc: '10000000000',
      credit: '300000000',
      authorized: true,
      admin: false,
      approvals: { auction: '1000000000' },
      tokens: {},
    },
  };
}
function financed(): MarketSnapshot {
  const snapshot = fixture();
  snapshot.assets[0].financing = {
    token,
    auction: token,
    activated: true,
    name: 'Shirt revenue',
    symbol: 'SHIRT',
    initialSupply: '1000000000000000000000',
    totalSupply: '1000000000000000000000',
    revenueBps: 5000,
    termStart: 1,
    termEnd: 900,
    accountedRevenue: '500000000',
    unresolvedCampaigns: '1',
    auctionSupply: '600000000000000000000',
    liquiditySupply: '200000000000000000000',
    liquidityCurrencyMps: 2_000_000,
    migrationBlock: '45',
    migrationAttempted: true,
    positionId: '1',
    poolId: '0x00',
    liquidityOwner: owner,
  };
  snapshot.launches['1'] = {
    block: '50',
    startBlock: '10',
    endBlock: '40',
    claimBlock: '41',
    checkpointBlock: '40',
    floorPrice: '7922816251',
    clearingPrice: '7922816251',
    minimumRaise: '50000000',
    grossRaised: '100000000',
    liquidityEstimate: '20000000',
    creatorProceedsEstimate: '80000000',
    fee: '0',
    graduated: true,
    bids: [],
  } as unknown as MarketSnapshot['launches'][string];
  snapshot.wallet!.tokens['1'] = '100000000000000000123';
  return snapshot;
}

test('published slots do not require financing or invent bids, prices or balances', () => {
  const state = mapMarketState(fixture());
  assert.equal(state.assets[0].financing, undefined);
  assert.equal(state.assets[0].draft.spots.length, 2);
  assert.ok(state.assets[0].draft.spots.every((s) => s.price === 0));
  assert.deepEqual(state.campaigns, []);
  assert.equal(state.people.find((p) => p.id === owner)?.usdc, 10_000_000_000);
  assert.equal(state.credits[owner], 300_000_000);
});

test('campaigns resolve their parent slot and retain their original payment terms', () => {
  const snapshot = financed();
  snapshot.campaigns = ['1', '2'].map((slotId, index) => ({
    id: slotId,
    slotId,
    state: 'displaying',
    bidStart: 10,
    bidEnd: 20,
    displayStart: 30,
    displayEnd: 900,
    minIncreaseBps: 1000,
    escrowBps: 6000,
    revenueBps: index === 0 ? 0 : 5000,
    financingSeries: index === 0 ? undefined : token,
    bidder: brand,
    bid: '1000000000',
    minimumBid: '1100000000',
    held: '600000000',
    winningArtworkURI: '/logo.png',
    winningArtworkHash: '0x00',
  }));
  snapshot.events = [
    {
      name: 'BidPlaced',
      args: {
        campaignId: '2',
        bidder: brand,
        amount: '1000000000',
        artworkURI: '/logo.png',
        artworkHash: '0x00',
      },
      at: 12_000,
      hash: '0x01',
      index: 0,
    },
    {
      name: 'CampaignFinalized',
      args: { campaignId: '2', released: '400000000' },
      at: 21_000,
      hash: '0x02',
      index: 0,
    },
    {
      name: 'PaymentReleased',
      args: { campaignId: '2', creatorAmount: '200000000', vaultAmount: '200000000' },
      at: 21_000,
      hash: '0x02',
      index: 1,
    },
  ];
  const state = mapMarketState(snapshot);
  assert.deepEqual(
    state.campaigns.map((c) => c.assetId),
    ['1', '1'],
  );
  assert.equal(state.campaigns[0].revenuePercent, 0);
  assert.equal(state.campaigns[0].series, undefined);
  const c = state.campaigns[1];
  assert.equal(c.held + c.creatorPaid + c.vaultPaid, c.bids[0].amount);
  assert.equal(c.upfront, c.creatorPaid + c.vaultPaid);
  assert.deepEqual(state.assets[0].financing?.contributions, { '2': 200_000_000 });
  assert.equal(redemptionReady(state, state.assets[0]), false);
});

test('one asset supply backs all slots and redemption observes the aggregate completion gate', () => {
  const snapshot = financed();
  let state = mapMarketState(snapshot);
  assert.equal(state.assets[0].financing?.holdings[owner], 100_000_000);
  assert.equal(redemptionReady(state, state.assets[0]), false);
  snapshot.assets[0].financing!.unresolvedCampaigns = '0';
  state = mapMarketState(snapshot);
  assert.equal(redemptionReady(state, state.assets[0]), true);
  snapshot.wallet!.tokens['1'] = '0';
  snapshot.wallet!.redemptions = { '1': '50000000' };
  state = mapMarketState(snapshot);
  assert.equal(state.assets[0].financing?.redemptions?.[owner], 50_000_000);
});

test('display precision floors token dust without unsafe floating-point conversions', () => {
  assert.equal(uiAmount('123456789123456789123', 18), 123456789);
  assert.throws(() => uiAmount('9007199254740992'), /display range/);
  assert.throws(() => uiAmount('-1'), /display range/);
});

test('nested wallet cancellations and contract failures never expose RPC diagnostics', () => {
  assert.match(
    friendlyMarketError({ cause: { code: 4001, message: 'User rejected' } }),
    /cancelled/,
  );
  assert.match(
    friendlyMarketError({ name: 'ContractFunctionRevertedError', message: 'calldata 0x123' }),
    /contract could not accept/,
  );
  assert.match(
    friendlyMarketError({ name: 'WaitForTransactionReceiptTimeoutError' }),
    /transaction link/,
  );
  assert.equal(friendlyMarketError(new Error('Enter a valid date.')), 'Enter a valid date.');
  assert.doesNotMatch(
    friendlyMarketError(new Error('Details:\nsecret RPC parameters')),
    /secret|parameters/,
  );
});
