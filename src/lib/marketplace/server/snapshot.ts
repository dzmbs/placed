import 'server-only';
import { erc20Abi, type Address } from 'viem';
import { listAssets, readAsset, readCampaign } from './reader';
import { publicClient, atBlock, latestBlock } from './chain';
import { contracts, deploymentBlock } from '../config';
import { auctionHouseAbi } from '../abi/AuctionHouse';
import { assetRevenueVaultAbi } from '../abi/AssetRevenueVault';
import { permit2Abi, universalRouter } from '../uniswap';
import { readLaunch } from './launch';
import { indexedEvents } from './events';
import { ReadCache } from '../read-cache';
import type { MarketSnapshot } from '../snapshot';
import { RequestError } from './http';
import { database } from './database';

type Head = Awaited<ReturnType<typeof latestBlock>>;
const publicReads = new ReadCache(2);
const walletReads = new ReadCache(128);
let previous:
  | { snapshot: MarketSnapshot; block: bigint; hash: string; fullAt: number; fullBlock: bigint }
  | undefined;
let hydrating: Promise<MarketSnapshot> | undefined;
let forceFloor = 0n;
let revision = 0;
const revisions = new WeakMap<MarketSnapshot, number>();

async function publicSnapshot(block: Head): Promise<MarketSnapshot> {
  return publicReads.read(
    block.hash,
    async () => {
      // Serialize heads so an older refresh cannot replace a newer snapshot.
      if (hydrating) await hydrating;
      const work = atBlock(block.number, () => hydrate(block), block.hash);
      hydrating = work;
      try {
        return await work;
      } finally {
        if (hydrating === work) hydrating = undefined;
      }
    },
    30000,
  );
}
async function hydrate(block: Head): Promise<MarketSnapshot> {
  const logs = await indexedEvents({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    fromBlock: deploymentBlock,
    toBlock: block.number,
  });
  const db = database();
  db.exec(
    'CREATE TABLE IF NOT EXISTS chain_times (hash TEXT PRIMARY KEY, timestamp INTEGER NOT NULL)',
  );
  const times = new Map<string, number>();
  for (const log of logs) {
    if (times.has(log.blockHash)) continue;
    let row = db.prepare('SELECT timestamp FROM chain_times WHERE hash = ?').get(log.blockHash) as
      { timestamp: number } | undefined;
    if (!row) {
      const historical = await publicClient.getBlock({ blockHash: log.blockHash });
      row = { timestamp: Number(historical.timestamp) * 1000 };
      db.prepare('INSERT OR IGNORE INTO chain_times VALUES(?,?)').run(log.blockHash, row.timestamp);
    }
    times.set(log.blockHash, row.timestamp);
  }
  const events: MarketSnapshot['events'] = logs.map((log) => ({
    name: log.eventName,
    args: Object.fromEntries(Object.entries(log.args).map(([key, value]) => [key, String(value)])),
    at: times.get(log.blockHash)!,
    hash: log.transactionHash,
    index: log.logIndex,
  }));
  const full =
    !previous ||
    previous.fullBlock < forceFloor ||
    Date.now() - previous.fullAt >= 30000 ||
    previous.block > block.number ||
    (await publicClient.getBlock({ blockNumber: previous.block })).hash !== previous.hash;
  const changes = previous ? logs.filter((log) => log.blockNumber > previous!.block) : logs;
  const newAsset = changes.some((log) => log.eventName === 'AssetPublished');
  const dirtyAssets = new Set<string>();
  const dirtyCampaigns = new Set<string>();
  for (const log of changes) {
    const args = log.args as Record<string, unknown>;
    if (args.assetId !== undefined) dirtyAssets.add(String(args.assetId));
    if (args.campaignId !== undefined) {
      const id = String(args.campaignId);
      dirtyCampaigns.add(id);
      const campaign = previous?.snapshot.campaigns.find((item) => item.id === id);
      const parent = previous?.snapshot.assets.find((asset) =>
        asset.slots.some((slot) => slot.id === (campaign?.slotId ?? String(args.slotId))),
      );
      if (parent) dirtyAssets.add(parent.id);
    }
  }
  // ENS records can change directly, without an AuctionHouse event. A periodic
  // refresh picks those up; receipt-bound refreshes below also force hydration.
  const assets =
    full || newAsset
      ? await listAssets()
      : await Promise.all(
          previous!.snapshot.assets.map((asset) =>
            dirtyAssets.has(asset.id) || asset.financing ? readAsset(BigInt(asset.id)) : asset,
          ),
        );
  let ids: string[];
  if (full) {
    const count = await publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'campaignCount',
    });
    if (count > 500n) throw new RequestError('The demo indexer needs campaign pagination.', 503);
    ids = Array.from({ length: Number(count) }, (_, i) => String(i + 1));
  } else
    ids = [...new Set([...previous!.snapshot.campaigns.map((item) => item.id), ...dirtyCampaigns])];
  const campaigns = await Promise.all(
    ids.map((id) =>
      full || dirtyCampaigns.has(id)
        ? readCampaign(BigInt(id))
        : previous!.snapshot.campaigns.find((item) => item.id === id)!,
    ),
  );
  const launches = Object.fromEntries(
    await Promise.all(
      assets
        .filter((asset) => asset.financing)
        .map(async (asset) => [
          asset.id,
          await readLaunch(asset.id, undefined, asset, block.number),
        ]),
    ),
  );
  const snapshot = { assets, campaigns, launches, events, now: Number(block.timestamp) * 1000 };
  if (!previous || previous.block <= block.number)
    previous = {
      snapshot,
      block: block.number,
      hash: block.hash,
      fullAt: full ? Date.now() : previous!.fullAt,
      fullBlock: full ? block.number : previous!.fullBlock,
    };
  revisions.set(snapshot, ++revision);
  return snapshot;
}

export async function marketSnapshot(
  block: Head,
  wallet?: Address,
  minimum = 0n,
): Promise<MarketSnapshot> {
  if (minimum > (previous?.fullBlock ?? 0n)) {
    forceFloor = minimum > forceFloor ? minimum : forceFloor;
    publicReads.invalidate(block.hash);
  }
  const shared = await publicSnapshot(block);
  if (!wallet) return shared;
  return walletReads.read(
    `${block.hash}:${revisions.get(shared)}:${wallet.toLowerCase()}`,
    () =>
      atBlock(
        block.number,
        async () => {
          const snapshot = { ...shared, launches: { ...shared.launches } } as MarketSnapshot;
          for (const asset of shared.assets.filter((asset) => asset.financing))
            snapshot.launches[asset.id] = await readLaunch(asset.id, wallet, asset, block.number);
          return attachWallet(snapshot, block, wallet);
        },
        block.hash,
      ),
    30000,
  );
}

async function attachWallet(snapshot: MarketSnapshot, block: Head, wallet: Address) {
  if (wallet) {
    const [usdc, credit, authorized, owner, auctionAllowance, permitAllowance] =
      await publicClient.multicall({
        allowFailure: false,
        contracts: [
          { address: contracts.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] },
          {
            address: contracts.auctionHouse,
            abi: auctionHouseAbi,
            functionName: 'withdrawalCredits',
            args: [wallet],
          },
          {
            address: contracts.auctionHouse,
            abi: auctionHouseAbi,
            functionName: 'authorizedParticipants',
            args: [wallet],
          },
          { address: contracts.auctionHouse, abi: auctionHouseAbi, functionName: 'owner' },
          {
            address: contracts.usdc,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [wallet, contracts.auctionHouse],
          },
          {
            address: contracts.usdc,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [wallet, contracts.permit2],
          },
        ] as const,
      });
    const approvals: Record<string, string> = { auction: String(auctionAllowance) };
    const tokens: Record<string, string> = {};
    const redemptions: Record<string, string> = {};
    for (const asset of snapshot.assets) {
      if (!asset.financing) continue;
      const token = asset.financing.token;
      const redeemed = (
        await indexedEvents({
          address: token,
          abi: assetRevenueVaultAbi,
          eventName: 'Redeemed',
          fromBlock: deploymentBlock,
          toBlock: block.number,
        })
      ).filter((event) => event.args.holder.toLowerCase() === wallet.toLowerCase());
      if (redeemed.length)
        redemptions[asset.id] = String(
          redeemed.reduce((sum, event) => sum + (event.args.amount ?? 0n), 0n),
        );
      tokens[asset.id] = String(
        await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [wallet],
        }),
      );
      for (const [scope, spender] of [
        [`sale:${asset.id}`, asset.financing.auction],
        [`trade:${asset.id}`, universalRouter],
      ] as [string, Address][]) {
        const [amount, expiration] = await publicClient.readContract({
          address: contracts.permit2,
          abi: permit2Abi,
          functionName: 'allowance',
          args: [wallet, contracts.usdc, spender],
        });
        approvals[scope] = String(
          expiration > block.timestamp ? (amount < permitAllowance ? amount : permitAllowance) : 0n,
        );
      }
    }
    snapshot.wallet = {
      address: wallet,
      usdc: String(usdc),
      credit: String(credit),
      authorized,
      admin: owner.toLowerCase() === wallet.toLowerCase(),
      approvals,
      tokens,
      redemptions,
    };
  }

  return snapshot;
}
