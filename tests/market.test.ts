import assert from 'node:assert/strict';
import test from 'node:test';
import {
  campaignStatus,
  minimumBid,
  mulDiv,
  units,
  UNIT,
  type CampaignRecord,
  type MarketState,
} from '../src/lib/market';
import { assertCanConfirm, validateSwapQuote, type SwapQuote } from '../src/lib/market-client';

const campaign: CampaignRecord = {
  id: 'campaign',
  assetId: 'asset',
  slotId: 'front',
  startingBid: 250 * UNIT,
  opens: 1000,
  closes: 2000,
  start: 3000,
  end: 4000,
  increment: 1000,
  escrowPercent: 6000,
  revenuePercent: 0,
  status: 'open',
  bids: [],
  held: 0,
  upfront: 0,
  creatorPaid: 0,
  vaultPaid: 0,
  artworkPermission: false,
};
const state: MarketState = {
  now: 1000,
  current: 'owner',
  network: 'supported',
  people: [],
  assets: [],
  campaigns: [],
  credits: {},
  receipts: [],
};
const quote: SwapQuote = {
  id: 'quote-1',
  received: 100,
  minimum: 95,
  fee: 1,
  impact: 0.5,
  expires: 2000,
};

test('amount parsing preserves six decimal places and the safe integer boundary', () => {
  assert.equal(units('0.000001'), 1);
  assert.equal(units('1234.567891'), 1234567891);
  assert.equal(units('9007199254.740991'), Number.MAX_SAFE_INTEGER);
  for (const value of ['9007199254.740992', '0', '-1', 'NaN', '1e6', '0.0000001', ''])
    assert.throws(() => units(value));
});

test('percentage calculations round bids upward without floating-point loss', () => {
  assert.equal(mulDiv(1000001, 1000, 10000, true), 100001);
  assert.equal(mulDiv(1000001, 1000, 10000), 100000);
  assert.throws(() => mulDiv(1, 1, 0));
  assert.throws(() => mulDiv(Number.MAX_SAFE_INTEGER, 2, 1));
});

test('first bid uses the campaign opening price; subsequent bids use the increment', () => {
  assert.equal(minimumBid(campaign), 250 * UNIT);
  const funded = {
    ...campaign,
    bids: [
      {
        user: 'brand',
        amount: 250000001,
        at: 1500,
        artwork: { name: 'logo', url: '/logo.png', hash: 'hash' },
      },
    ],
  };
  assert.equal(minimumBid(funded), 275000002);
});

test('campaign labels follow time boundaries and preserve settlement status', () => {
  assert.equal(campaignStatus(campaign, 999), 'Scheduled');
  assert.equal(campaignStatus(campaign, 1000), 'Bidding open');
  assert.equal(campaignStatus(campaign, 2000), 'Auction ended');
  assert.equal(campaignStatus({ ...campaign, status: 'refunded' }, 5000), 'Refunded');
});

test('account or network changes invalidate an open transaction review', () => {
  assert.doesNotThrow(() => assertCanConfirm(state, { type: 'withdraw' }, 'owner'));
  assert.throws(
    () => assertCanConfirm({ ...state, current: 'other' }, { type: 'withdraw' }, 'owner'),
    /wallet changed/,
  );
  assert.throws(
    () => assertCanConfirm({ ...state, current: null }, { type: 'withdraw' }, 'owner'),
    /wallet changed/,
  );
  assert.throws(
    () => assertCanConfirm({ ...state, network: 'unsupported' }, { type: 'withdraw' }, 'owner'),
    /network/,
  );
  assert.throws(
    () => assertCanConfirm({ ...state, network: undefined }, { type: 'withdraw' }, 'owner'),
    /network/,
  );
});

test('quotes are rejected at expiry, even after an approval was confirmed', () => {
  const action = {
    type: 'swap' as const,
    quoteId: quote.id,
    assetId: 'asset',
    side: 'buy' as const,
    amount: 100,
    minimum: quote.minimum,
    expires: quote.expires,
  };
  assert.doesNotThrow(() => assertCanConfirm(state, action, 'owner'));
  assert.throws(() => assertCanConfirm({ ...state, now: 2000 }, action, 'owner'), /expired/);
});

test('malformed or stale backend quotes cannot enable a trade', () => {
  assert.equal(validateSwapQuote(quote, 1000), quote);
  for (const invalid of [
    { ...quote, id: '' },
    { ...quote, received: NaN },
    { ...quote, minimum: 0 },
    { ...quote, minimum: 101 },
    { ...quote, fee: -1 },
    { ...quote, impact: Infinity },
    { ...quote, expires: 1000 },
    { ...quote, received: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => validateSwapQuote(invalid, 1000), /valid price/);
});
