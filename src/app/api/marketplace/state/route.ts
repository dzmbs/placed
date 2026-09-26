import { erc20Abi, type Address } from 'viem';
import { listAssets, readCampaign } from '@/lib/marketplace/server/reader';
import { publicClient } from '@/lib/marketplace/server/chain';
import { contracts, deploymentBlock } from '@/lib/marketplace/config';
import { assetRevenueVaultAbi } from '@/lib/marketplace/abi/AssetRevenueVault';
import { auctionHouseAbi } from '@/lib/marketplace/abi/AuctionHouse';
import { permit2Abi, universalRouter } from '@/lib/marketplace/uniswap';
import { readLaunch } from '@/lib/marketplace/server/launch';
import { walletAddress } from '@/lib/marketplace/server/auth';
import { failure, RequestError } from '@/lib/marketplace/server/http';
import type { MarketSnapshot } from '@/lib/marketplace/snapshot';
import { readEventRange } from '@/lib/marketplace/event-range';

export const runtime = 'nodejs';
let indexed = deploymentBlock - 1n;
let events: MarketSnapshot['events'] = [];
let updating: Promise<void> | undefined;
async function indexEvents(to: bigint) {
  if (updating) await updating;
  if (to <= indexed) return;
  updating = (async () => {
    const logs = await readEventRange(indexed + 1n, to, (fromBlock, toBlock) =>
      publicClient.getContractEvents({
        address: contracts.auctionHouse,
        abi: auctionHouseAbi,
        fromBlock,
        toBlock,
      }),
    );
    const times = new Map<string, number>();
    for (const log of logs) {
      const key = String(log.blockNumber);
      if (!times.has(key)) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        times.set(key, Number(block.timestamp) * 1000);
      }
    }
    const next = logs.map((log) => ({
      name: log.eventName,
      args: Object.fromEntries(
        Object.entries(log.args).map(([key, value]) => [key, String(value)]),
      ),
      at: times.get(String(log.blockNumber))!,
      hash: log.transactionHash,
      index: log.logIndex,
    }));
    events = [...events, ...next];
    indexed = to;
  })();
  try {
    await updating;
  } finally {
    updating = undefined;
  }
}

export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get('wallet');
    const wallet = value ? walletAddress(value) : undefined;
    const block = await publicClient.getBlock();
    await indexEvents(block.number);
    const assets = await listAssets();
    const count = await publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'campaignCount',
    });
    if (count > 500n) throw new RequestError('The demo indexer needs campaign pagination.', 503);
    const campaigns = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => readCampaign(BigInt(i + 1))),
    );
    const launches = Object.fromEntries(
      await Promise.all(
        assets
          .filter((asset) => asset.financing)
          .map(async (asset) => [asset.id, await readLaunch(asset.id, wallet)]),
      ),
    );
    const snapshot: MarketSnapshot = {
      assets,
      campaigns,
      launches,
      events,
      now: Number(block.timestamp) * 1000,
    };
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
      for (const asset of assets) {
        if (!asset.financing) continue;
        const token = asset.financing.token;
        const redeemed = await readEventRange(deploymentBlock, block.number, (fromBlock, toBlock) =>
          publicClient.getContractEvents({
            address: token,
            abi: assetRevenueVaultAbi,
            eventName: 'Redeemed',
            args: { holder: wallet },
            fromBlock,
            toBlock,
          }),
        );
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
            expiration > block.timestamp
              ? amount < permitAllowance
                ? amount
                : permitAllowance
              : 0n,
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
    return Response.json(snapshot, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
