import 'server-only';
import { parseAbi, zeroAddress, type Address } from 'viem';
import { auctionHouseAbi } from '../abi/AuctionHouse';
import { assetRevenueVaultAbi } from '../abi/AssetRevenueVault';
import { assetLaunchCoordinatorAbi } from '../abi/AssetLaunchCoordinator';
import { ensAssetRegistryAbi } from '../abi/ENSAssetRegistry';
import { contracts, ensParent } from '../config';
import type {
  Asset,
  AssetMetadata,
  AdSlot,
  AdvertisingCampaign,
  SlotMetadata,
  CampaignState,
} from '../domain';
import { publicClient, requireDeployment } from './chain';
import { localMetadata, validateMetadata } from './media';
import { RequestError } from './http';
import { readEnsText } from '../ens';

const states: CampaignState[] = ['bidding', 'displaying', 'completed', 'no-sale', 'refunded'];
const registryAbi = parseAbi([
  'function getSubregistry(string) view returns(address)',
  'function getResolver(string) view returns(address)',
]);
const ethRegistry = '0x657ea849311d3d5823348dded7c2aaafb3ede09e' as Address;
async function ensAssetRegistry(id: bigint) {
  const root = await publicClient.readContract({
    address: ethRegistry,
    abi: registryAbi,
    functionName: 'getSubregistry',
    args: [ensParent.split('.')[0]],
  });
  const expected = await publicClient.readContract({
    address: contracts.naming,
    abi: ensAssetRegistryAbi,
    functionName: 'rootRegistry',
  });
  if (root.toLowerCase() !== expected.toLowerCase())
    throw new RequestError('The ENS namespace does not match this deployment.', 503);
  return {
    root,
    child: await publicClient.readContract({
      address: root,
      abi: registryAbi,
      functionName: 'getSubregistry',
      args: [`a${id}`],
    }),
  };
}
async function metadata<T extends AssetMetadata | SlotMetadata>(
  uri: string,
  kind: 'asset' | 'slot',
) {
  try {
    const data = await localMetadata<Record<string, unknown>>(uri);
    return data ? (validateMetadata(kind, data) as T) : undefined;
  } catch {
    return undefined;
  }
}
export function chainId(value: string): bigint {
  if (!/^[1-9]\d{0,19}$/.test(value)) throw new RequestError('Invalid record ID.');
  return BigInt(value);
}
export async function readCampaign(id: bigint): Promise<AdvertisingCampaign> {
  const [campaign, minimum] = await Promise.all([
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'getCampaign',
      args: [id],
    }),
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'minimumBid',
      args: [id],
    }),
  ]);
  return {
    id: String(id),
    slotId: String(campaign.slotId),
    state: states[campaign.state],
    bidStart: Number(campaign.terms.bidStart),
    bidEnd: Number(campaign.terms.bidEnd),
    displayStart: Number(campaign.terms.displayStart),
    displayEnd: Number(campaign.terms.displayEnd),
    minIncreaseBps: campaign.terms.minIncreaseBps,
    escrowBps: campaign.terms.escrowBps,
    revenueBps: campaign.revenueBps,
    financingSeries:
      campaign.financingSeries === zeroAddress ? undefined : campaign.financingSeries,
    bidder: campaign.bidder === zeroAddress ? undefined : campaign.bidder,
    bid: String(campaign.bid),
    minimumBid: String(minimum),
    held: String(campaign.held),
    winningArtworkURI: campaign.artworkURI,
    winningArtworkHash: campaign.artworkHash,
  };
}
export async function readSlot(id: bigint): Promise<AdSlot> {
  const slot = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'getSlot',
    args: [id],
  });
  const ensName = `s${id}.a${slot.assetId}.${ensParent}`;
  const { child } = await ensAssetRegistry(slot.assetId);
  const [resolver, dnsName, campaign] = await Promise.all([
    publicClient.readContract({
      address: child,
      abi: registryAbi,
      functionName: 'getResolver',
      args: [`s${id}`],
    }),
    publicClient.readContract({
      address: contracts.naming,
      abi: ensAssetRegistryAbi,
      functionName: 'slotNames',
      args: [id],
    }),
    slot.currentCampaignId ? readCampaign(slot.currentCampaignId) : undefined,
  ]);
  const [record, publicArtwork] = await Promise.all([
    readEnsText(publicClient, resolver, ensName, 'ad.metadata'),
    readEnsText(publicClient, resolver, ensName, 'ad.artwork'),
  ]);
  const slotMetadata =
    record === slot.metadataURI ? await metadata<SlotMetadata>(record, 'slot') : undefined;
  return {
    id: String(id),
    assetId: String(slot.assetId),
    metadataURI: slot.metadataURI,
    metadata: slotMetadata,
    ensName,
    resolver,
    dnsName,
    publicArtwork: campaign?.state === 'displaying' ? publicArtwork : undefined,
    campaign,
  };
}
export async function readAsset(id: bigint): Promise<Asset> {
  requireDeployment();
  const asset = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'getAsset',
    args: [id],
  });
  const slotCount = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'slotCount',
  });
  if (slotCount > 500n)
    throw new RequestError('The demo indexer needs pagination for this many slots.', 503);
  const slotRecords = await publicClient.multicall({
    allowFailure: false,
    contracts: Array.from(
      { length: Number(slotCount) },
      (_, index) =>
        ({
          address: contracts.auctionHouse,
          abi: auctionHouseAbi,
          functionName: 'getSlot',
          args: [BigInt(index + 1)],
        }) as const,
    ),
  });
  const ids = slotRecords.flatMap((slot, index) =>
    slot.assetId === id ? [BigInt(index + 1)] : [],
  );
  const ensName = `a${id}.${ensParent}`;
  const { root } = await ensAssetRegistry(id);
  const resolver = await publicClient.readContract({
    address: root,
    abi: registryAbi,
    functionName: 'getResolver',
    args: [`a${id}`],
  });
  const [record, tokenRecord] = await Promise.all(
    ['ad.metadata', 'ad.revenueToken'].map((key) =>
      readEnsText(publicClient, resolver, ensName, key),
    ),
  );
  const [assetMetadata, slots] = await Promise.all([
    record === asset.metadataURI ? metadata<AssetMetadata>(record, 'asset') : undefined,
    Promise.all(ids.map(readSlot)),
  ]);
  const result: Asset = {
    id: String(id),
    creator: { wallet: asset.creator },
    metadataURI: asset.metadataURI,
    metadata: assetMetadata,
    ensName,
    slots,
  };
  if (asset.financingSeries !== zeroAddress) {
    if (tokenRecord.toLowerCase() !== asset.financingSeries.toLowerCase())
      throw new RequestError('ENS and the registered revenue token disagree.', 503);
    result.financing = await readFinancing(id, asset.financingSeries, asset.creator);
  }
  return result;
}
async function readFinancing(id: bigint, token: Address, creator: Address) {
  const launch = await publicClient.readContract({
    address: contracts.launchCoordinator,
    abi: assetLaunchCoordinatorAbi,
    functionName: 'launches',
    args: [id],
  });
  if (launch[0].toLowerCase() !== token.toLowerCase())
    throw new RequestError('The asset financing references do not match.', 503);
  const names = [
    'activated',
    'name',
    'symbol',
    'totalSupply',
    'initialSupply',
    'revenueBps',
    'termStart',
    'termEnd',
    'accountedRevenue',
    'unresolvedCampaigns',
  ] as const;
  const values = await publicClient.multicall({
    allowFailure: false,
    contracts: names.map((functionName) => ({
      address: token,
      abi: assetRevenueVaultAbi,
      functionName,
    })),
  });
  return {
    token,
    auction: launch[1],
    activated: Boolean(values[0]),
    name: String(values[1]),
    symbol: String(values[2]),
    totalSupply: String(values[3]),
    initialSupply: String(values[4]),
    revenueBps: Number(values[5]),
    termStart: Number(values[6]),
    termEnd: Number(values[7]),
    accountedRevenue: String(values[8]),
    unresolvedCampaigns: String(values[9]),
    auctionSupply: String(launch[3]),
    liquiditySupply: String(launch[4]),
    liquidityCurrencyMps: launch[5],
    migrationBlock: String(launch[6]),
    positionId: String(launch[7]),
    poolId: launch[8],
    migrationAttempted: launch[9],
    liquidityOwner: creator,
  };
}
export async function listAssets() {
  requireDeployment();
  const count = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'assetCount',
  });
  const length = Math.min(Number(count), 50);
  return Promise.all(Array.from({ length }, (_, index) => readAsset(count - BigInt(index))));
}
