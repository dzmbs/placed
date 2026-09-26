import { ASSETS } from './studio';
import type { Draft } from './types';

// UI amounts are six-decimal fixed-point integers. The adapter converts on-chain decimals.
export const UNIT = 1_000_000;
export const PENDING_KEY = 'placed-market-pending-v1';
export type Person = {
  id: string;
  name: string;
  address?: string;
  role: 'creator' | 'brand' | 'investor' | 'admin';
  verified: boolean;
  usdc: number;
  approvals: Record<string, number>;
};
export type Artwork = { name: string; url: string; hash: string };
export type MarketAsset = {
  id: string;
  owner: string;
  name: string;
  description: string;
  ens: string;
  draft: Draft;
  financing?: Financing;
};
export type CampaignRecord = {
  id: string;
  assetId: string;
  slotId: string;
  startingBid: number;
  opens: number;
  closes: number;
  start: number;
  end: number;
  increment: number;
  escrowPercent: number;
  series?: string;
  revenuePercent: number;
  status: 'open' | 'booked' | 'completed' | 'refunded' | 'no-sale';
  bids: Bid[];
  held: number;
  upfront: number;
  creatorPaid: number;
  vaultPaid: number;
  proof?: Artwork;
  proofResult?: 'pending' | 'match' | 'inconclusive';
  publicArtwork?: Artwork;
  artworkPermission: boolean;
};
export type Bid = { user: string; amount: number; artwork: Artwork; at: number };
export type SaleBid = {
  id: string;
  user: string;
  budget: number;
  maxPrice: number;
  tokens: number;
  spent: number;
  claimed: boolean;
};
export type Financing = {
  saleStarted?: boolean;
  saleEnded?: boolean;
  claimable?: boolean;
  migrationReady?: boolean;
  block?: string;
  startBlock?: string;
  endBlock?: string;
  clearingPrice?: number;
  allocationPending?: boolean;
  unresolvedCampaigns?: number;
  liquidityOwner?: string;
  redemptions?: Record<string, number>;
  id: string;
  name: string;
  symbol: string;
  percent: number;
  start: number;
  end: number;
  totalSupply: number;
  remainingSupply: number;
  saleSupply: number;
  lpSupply: number;
  floor: number;
  threshold: number;
  closes: number;
  status: 'fundraising' | 'migration' | 'active' | 'failed' | 'deadline';
  bids: SaleBid[];
  holdings: Record<string, number>;
  vault: number;
  contributions: Record<string, number>;
  poolUsdc: number;
  poolTokens: number;
  gross: number;
  fee: number;
  net: number;
  proceedsClaimed: boolean;
};
export type Receipt = { id: string; at: number; user: string; title: string };
export type MarketState = {
  network?: 'supported' | 'unsupported';
  networkName?: string;
  now: number;
  current: string | null;
  people: Person[];
  assets: MarketAsset[];
  campaigns: CampaignRecord[];
  credits: Record<string, number>;
  receipts: Receipt[];
};
export type CampaignTerms = Pick<
  CampaignRecord,
  | 'assetId'
  | 'slotId'
  | 'startingBid'
  | 'opens'
  | 'closes'
  | 'start'
  | 'end'
  | 'increment'
  | 'escrowPercent'
>;
export type FinanceTerms = { biddingBlocks?: number } & Pick<
  Financing,
  'name' | 'symbol' | 'percent' | 'start' | 'end' | 'totalSupply' | 'floor' | 'threshold' | 'closes'
>;
export type MarketAction =
  | { type: 'load-proofs' }
  | { type: 'faucet' }
  | { type: 'approve'; scope: string; amount: number }
  | { type: 'publish'; draft: Draft; name: string; description: string }
  | { type: 'campaign'; terms: CampaignTerms }
  | { type: 'bid'; campaignId: string; amount: number; artwork: Artwork }
  | { type: 'withdraw' }
  | { type: 'finalize'; campaignId: string }
  | { type: 'artwork'; campaignId: string; artwork: Artwork }
  | { type: 'proof'; campaignId: string; proof: Artwork }
  | { type: 'release' | 'refund'; campaignId: string }
  | { type: 'finance'; assetId: string; terms: FinanceTerms }
  | { type: 'sale-bid'; assetId: string; budget: number; maxPrice: number }
  | { type: 'sale-close' | 'sale-claim' | 'activate' | 'redeem'; assetId: string }
  | {
      type: 'swap';
      quoteId: string;
      assetId: string;
      side: 'buy' | 'sell';
      amount: number;
      minimum: number;
      expires: number;
    };

function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function mulDiv(a: number, b: number, denominator: number, up = false) {
  demand(
    [a, b, denominator].every(Number.isSafeInteger) && a >= 0 && b >= 0 && denominator > 0,
    'Amount is outside the supported range.',
  );
  const product = BigInt(a) * BigInt(b),
    divisor = BigInt(denominator);
  const result = Number((product + (up ? divisor - BigInt(1) : BigInt(0))) / divisor);
  demand(Number.isSafeInteger(result), 'Amount is outside the supported range.');
  return result;
}
export function units(value: string | number) {
  const text = String(value).trim();
  demand(/^\d+(\.\d{1,6})?$/.test(text), 'Enter a positive amount with up to six decimals.');
  const [whole, fraction = ''] = text.split('.');
  const exact = BigInt(whole) * BigInt(UNIT) + BigInt(fraction.padEnd(6, '0'));
  demand(exact > 0 && exact <= BigInt(Number.MAX_SAFE_INTEGER), 'Enter a valid positive amount.');
  return Number(exact);
}
export function display(value: number, decimals = 2) {
  return (value / UNIT).toLocaleString('en-US', { maximumFractionDigits: decimals });
}
export const dateLabel = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export function topBid(campaign: CampaignRecord) {
  return campaign.bids.at(-1);
}
export function minimumBid(campaign: CampaignRecord) {
  const bid = topBid(campaign);
  return bid
    ? bid.amount + Math.max(1, mulDiv(bid.amount, campaign.increment, 10000, true))
    : campaign.startingBid;
}
export function campaignStatus(campaign: CampaignRecord, now: number) {
  const labels = {
    booked: 'Booked',
    completed: 'Completed',
    refunded: 'Refunded',
    'no-sale': 'No bids',
  };
  return campaign.status !== 'open'
    ? labels[campaign.status]
    : now < campaign.opens
      ? 'Scheduled'
      : now >= campaign.closes
        ? 'Auction ended'
        : 'Bidding open';
}
export function redemptionReady(state: MarketState, asset: MarketAsset) {
  const f = asset.financing;
  return (
    !!f &&
    f.status === 'active' &&
    state.now >= f.end &&
    (f.unresolvedCampaigns ?? 0) === 0 &&
    state.campaigns
      .filter((c) => c.series === f.id)
      .every((c) => ['completed', 'refunded', 'no-sale'].includes(c.status))
  );
}
export function assetCategory(asset: MarketAsset) {
  return ASSETS.find((a) => a.id === asset.draft.asset)?.label ?? 'CUSTOM';
}
