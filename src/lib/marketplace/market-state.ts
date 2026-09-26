import { initialDraft } from '@/lib/studio';
import type { CampaignRecord, Financing, MarketState, Person } from '@/lib/market';
import type { MarketSnapshot } from './snapshot';

export function uiAmount(raw: string | bigint, decimals = 6) {
  if (!Number.isInteger(decimals) || decimals < 6 || decimals > 36 || BigInt(raw) < 0n)
    throw new Error('This amount is outside the display range.');
  const amount = BigInt(raw) / 10n ** BigInt(decimals - 6);
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('This amount is outside the display range.');
  return Number(amount);
}
export function uiPrice(raw: string) {
  return uiAmount((BigInt(raw) * 10n ** 18n + (1n << 96n) - 1n) / (1n << 96n));
}
const identity = (address: string) => address.toLowerCase();
export function mapMarketState(snapshot: MarketSnapshot): MarketState {
  const current = snapshot.wallet ? identity(snapshot.wallet.address) : null;
  const people = new Map<string, Person>();
  function person(address: string) {
    const id = identity(address);
    if (!people.has(id))
      people.set(id, {
        id,
        address,
        name: `${address.slice(0, 6)}…${address.slice(-4)}`,
        role: 'brand',
        verified: false,
        usdc: 0,
        approvals: {},
      });
    return people.get(id)!;
  }
  const campaigns: CampaignRecord[] = snapshot.campaigns.map((c) => {
    const asset = snapshot.assets.find((a) => a.slots.some((s) => s.id === c.slotId));
    if (!asset) throw new Error('Campaign parent asset could not be resolved.');
    const slot = asset.slots.find((s) => s.id === c.slotId)!;
    const logs = snapshot.events.filter((e) => e.args.campaignId === c.id);
    const payments = logs.filter((e) => e.name === 'PaymentReleased');
    const creatorPaid = payments.reduce((sum, e) => sum + BigInt(e.args.creatorAmount), 0n);
    const vaultPaid = payments.reduce((sum, e) => sum + BigInt(e.args.vaultAmount), 0n);
    const upfront = logs.find((e) => e.name === 'CampaignFinalized')?.args.released ?? '0';
    return {
      id: c.id,
      assetId: asset.id,
      slotId: c.slotId,
      startingBid: 1_000_000,
      opens: c.bidStart * 1000,
      closes: c.bidEnd * 1000,
      start: c.displayStart * 1000,
      end: c.displayEnd * 1000,
      increment: c.minIncreaseBps,
      escrowPercent: c.escrowBps,
      revenuePercent: c.revenueBps,
      series: c.financingSeries?.toLowerCase(),
      status: (
        {
          bidding: 'open',
          displaying: 'booked',
          completed: 'completed',
          refunded: 'refunded',
          'no-sale': 'no-sale',
        } as const
      )[c.state],
      bids: logs
        .filter((e) => e.name === 'BidPlaced')
        .map((e) => ({
          user: person(e.args.bidder).id,
          amount: uiAmount(e.args.amount),
          at: e.at,
          artwork: { name: 'Bid artwork', url: e.args.artworkURI, hash: e.args.artworkHash },
        })),
      held: uiAmount(c.held),
      upfront: uiAmount(upfront),
      creatorPaid: uiAmount(creatorPaid),
      vaultPaid: uiAmount(vaultPaid),
      publicArtwork:
        c.state === 'displaying' && slot.campaign?.id === c.id && slot.publicArtwork
          ? { name: 'Live artwork', url: slot.publicArtwork, hash: c.winningArtworkHash }
          : undefined,
      artworkPermission: c.state === 'displaying',
    };
  });
  const assets = snapshot.assets.map((asset) => {
    const owner = person(asset.creator.wallet);
    owner.role = 'creator';
    const meta = asset.metadata;
    if (!meta) throw new Error(`Listing ${asset.id} metadata is unavailable.`);
    const defaults = initialDraft();
    let financing: Financing | undefined;
    const f = asset.financing,
      sale = snapshot.launches[asset.id];
    if (f && sale) {
      const ended = BigInt(sale.block) >= BigInt(sale.endBlock);
      const checkpointed = BigInt(sale.checkpointBlock) >= BigInt(sale.endBlock);
      financing = {
        id: f.token.toLowerCase(),
        name: f.name,
        symbol: f.symbol,
        percent: f.revenueBps,
        start: f.termStart * 1000,
        end: f.termEnd * 1000,
        totalSupply: uiAmount(f.initialSupply, 18),
        remainingSupply: uiAmount(f.totalSupply, 18),
        saleSupply: uiAmount(f.auctionSupply, 18),
        lpSupply: uiAmount(f.liquiditySupply, 18),
        floor: uiPrice(sale.floorPrice),
        clearingPrice: uiPrice(sale.clearingPrice),
        threshold: uiAmount(sale.minimumRaise),
        closes:
          snapshot.now + Math.max(0, Number(BigInt(sale.endBlock) - BigInt(sale.block))) * 12000,
        block: sale.block,
        startBlock: sale.startBlock,
        endBlock: sale.endBlock,
        saleStarted: BigInt(sale.block) >= BigInt(sale.startBlock),
        saleEnded: ended,
        claimable: BigInt(sale.block) >= BigInt(sale.claimBlock),
        migrationReady: BigInt(sale.block) >= BigInt(f.migrationBlock),
        status: f.activated
          ? 'active'
          : !ended || !checkpointed
            ? 'fundraising'
            : !sale.graduated
              ? 'failed'
              : snapshot.now >= f.termStart * 1000
                ? 'deadline'
                : 'migration',
        bids: current
          ? sale.bids.map((b) => ({
              id: b.id,
              user: current,
              budget: uiAmount(b.budget),
              maxPrice: uiPrice(b.maxPrice),
              tokens: uiAmount(b.allocated ?? b.tokensFilled, 18),
              spent: b.refunded === undefined ? 0 : uiAmount(BigInt(b.budget) - BigInt(b.refunded)),
              claimed: b.claimed || (b.exited && BigInt(b.tokensFilled) === 0n),
            }))
          : [],
        allocationPending: sale.bids.some((b) => !b.exited),
        holdings: current
          ? { [current]: uiAmount(snapshot.wallet!.tokens[asset.id] ?? '0', 18) }
          : {},
        redemptions:
          current && snapshot.wallet?.redemptions?.[asset.id] !== undefined
            ? { [current]: uiAmount(snapshot.wallet.redemptions[asset.id]) }
            : {},
        vault: uiAmount(f.accountedRevenue),
        unresolvedCampaigns: Number(f.unresolvedCampaigns),
        contributions: Object.fromEntries(
          campaigns
            .filter((c) => c.series === f.token.toLowerCase())
            .map((c) => [c.id, c.vaultPaid]),
        ),
        poolUsdc: uiAmount(sale.liquidityFunding ?? sale.liquidityEstimate),
        poolTokens: uiAmount(f.liquiditySupply, 18),
        gross: uiAmount(sale.grossRaised),
        fee: uiAmount(sale.fee),
        net: uiAmount(sale.creatorProceeds ?? sale.creatorProceedsEstimate),
        proceedsClaimed: sale.creatorProceeds !== undefined,
        liquidityOwner: f.liquidityOwner,
      };
    }
    return {
      id: asset.id,
      owner: owner.id,
      name: meta.title,
      description: meta.description,
      ens: asset.ensName,
      financing,
      draft: {
        ...defaults,
        asset: meta.kind,
        assetName: meta.title,
        assetUrl: meta.modelUrl,
        humanPreset: meta.humanPreset,
        color: meta.color,
        spots: asset.slots.map((slot) => {
          if (!slot.metadata) throw new Error(`Slot ${slot.id} metadata is unavailable.`);
          return {
            ...slot.metadata.placement,
            id: slot.id,
            name: slot.metadata.name,
            price: 0,
            artwork: slot.publicArtwork,
          };
        }),
        campaign: { ...defaults.campaign, title: meta.title, deliverables: meta.description },
      },
    };
  });
  if (snapshot.wallet) {
    const wallet = person(snapshot.wallet.address);
    wallet.usdc = uiAmount(snapshot.wallet.usdc);
    wallet.verified = snapshot.wallet.authorized;
    if (snapshot.wallet.admin) wallet.role = 'admin';
    wallet.approvals = Object.fromEntries(
      Object.entries(snapshot.wallet.approvals).map(([scope, raw]) => [
        scope,
        Number(
          BigInt(raw) > BigInt(Number.MAX_SAFE_INTEGER)
            ? BigInt(Number.MAX_SAFE_INTEGER)
            : BigInt(raw),
        ),
      ]),
    );
  }
  return {
    now: snapshot.now,
    current,
    people: [...people.values()],
    assets,
    campaigns,
    credits: current ? { [current]: uiAmount(snapshot.wallet!.credit) } : {},
    receipts: [],
  };
}
