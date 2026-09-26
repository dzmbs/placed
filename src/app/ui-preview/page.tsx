'use client';
// TEMPORARY design preview with mock data. Delete before shipping.
import { useMemo, useState } from 'react';
import { MarketProvider } from '@/components/market-provider';
import MarketExplore from '@/components/market-explore';
import MarketPortfolio from '@/components/market-portfolio';
import MarketAssetPage from '@/components/market-asset';
import { initialDraft, defaultSpots } from '@/lib/studio';
import type { MarketState, MarketAsset, CampaignRecord } from '@/lib/market';
import type { MarketClient } from '@/lib/market-client';
import type { AssetKind } from '@/lib/types';

const U = 1_000_000;
const me = '0x39028fF6F115fE17da41A3220DFd1F3cb57200e2';
const other = '0x8a1bC45E7d9e2F0aB3cD4e5F6a7B8c9D0e1F2a3B';
function asset(id: string, kind: AssetKind, name: string, owner: string): MarketAsset {
  const d = initialDraft();
  return {
    id,
    owner,
    name,
    description: 'Worn at TOKEN2049 Singapore, three event days, photographed all week.',
    ens: `${id}.placed.eth`,
    draft: { ...d, asset: kind, spots: defaultSpots(kind) },
  };
}
function build(): MarketState {
  const now = Date.now();
  const assets = [
    asset('a1', 'dress', 'TOKEN2049 conference dress', other),
    asset('a2', 'billboard', 'Brooklyn rooftop billboard', other),
    asset('a3', 'twitch', 'Speedrun stream background', me),
    asset('a4', 'bicycle', 'Ironman race bike', other),
    asset('a5', 'x-banner', 'X banner · 80k followers', other),
    asset('a6', 'suitcase', 'My everyday carry-on', me),
  ];
  const c = (
    id: string,
    a: MarketAsset,
    closesIn: number,
    bids: [string, number][],
    status: CampaignRecord['status'] = 'open',
  ): CampaignRecord => ({
    id,
    assetId: a.id,
    slotId: a.draft.spots[0].id,
    startingBid: 1 * U,
    opens: now - 3600_000,
    closes: now + closesIn,
    start: now + closesIn + 86400_000,
    end: now + closesIn + 5 * 86400_000,
    increment: 1000,
    escrowPercent: 6000,
    revenuePercent: 0,
    status,
    bids: bids.map(([user, amount], i) => ({
      user,
      amount: amount * U,
      artwork: { name: 'logo.png', url: '', hash: String(i) },
      at: now - (bids.length - i) * 600_000,
    })),
    held: 0,
    upfront: 0,
    creatorPaid: 0,
    vaultPaid: 0,
    artworkPermission: true,
  });
  return {
    network: 'supported',
    networkName: 'Ethereum Sepolia',
    now,
    current: me,
    people: [
      { id: me, name: me, address: me, role: 'creator', verified: true, usdc: 10_000 * U, approvals: {} },
      { id: other, name: other, address: other, role: 'creator', verified: true, usdc: 0, approvals: {} },
    ],
    assets,
    campaigns: [
      c('c1', assets[0], 2 * 3600_000 + 14 * 60_000, [[other, 120], [me, 150]]),
      c('c2', assets[1], 40 * 60_000, [[me, 900], [other, 1200]]),
      c('c3', assets[3], 3 * 86400_000, []),
      c('c4', assets[4], 20 * 3600_000, [[other, 45]]),
    ],
    credits: { [me]: 900 * U },
    receipts: [
      { id: 'r1', at: now - 300_000, user: me, title: 'place-bid' },
      { id: 'r2', at: now - 7200_000, user: me, title: 'withdraw-outbid-funds' },
      { id: 'r3', at: now - 86400_000, user: me, title: 'publish-listing' },
    ],
  };
}

export default function Page() {
  const [page] = useState(() =>
    typeof window === 'undefined' ? 'explore' : new URLSearchParams(location.search).get('p') ?? 'explore',
  );
  const client = useMemo<MarketClient>(() => {
    let state = build();
    return {
      getState: async () => ({ ...state, now: Date.now() }),
      connect: async () => state,
      changeWallet: async () => state,
      disconnect: async () => (state = { ...state, current: null }),
      switchNetwork: async () => state,
      verify: async () => state,
      execute: async () => {
        await new Promise((r) => setTimeout(r, 1500));
        return { state, message: '' };
      },
      quoteSwap: async () => {
        throw new Error('Trading is unavailable in preview.');
      },
    } as MarketClient;
  }, []);
  return (
    <MarketProvider client={client}>
      {page === 'portfolio' ? (
        <MarketPortfolio />
      ) : page === 'asset' ? (
        <MarketAssetPage id="a1" />
      ) : (
        <MarketExplore />
      )}
    </MarketProvider>
  );
}
