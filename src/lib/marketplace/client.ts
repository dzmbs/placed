'use client';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  erc20Abi,
  parseAbi,
  decodeEventLog,
  type Address,
  type Hex,
  type EIP1193Provider,
} from 'viem';
import { marketplaceChain, contracts, marketplaceReady } from './config';
import { auctionHouseAbi } from './abi/AuctionHouse';
import { assetLaunchCoordinatorAbi } from './abi/AssetLaunchCoordinator';
import { assetRevenueVaultAbi } from './abi/AssetRevenueVault';
import { demoUSDCAbi } from './abi/DemoUSDC';
import { ccaAbi, permit2Abi, universalRouter, encodeTrade, type TradeQuote } from './uniswap';
import type {
  AssetMetadata,
  SlotMetadata,
  ParticipantAuthorization,
  ProofAuthorization,
} from './domain';

export const browserPublicClient = createPublicClient({
  chain: marketplaceChain,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});
let walletProvider: (() => Promise<EIP1193Provider>) | undefined;
export function selectWalletProvider(value?: () => Promise<EIP1193Provider>) {
  walletProvider = value;
}
export interface WalletSession {
  wallet: Address;
  token: string;
  expires: number;
}
export async function api<T>(
  path: string,
  init?: RequestInit,
  session?: WalletSession,
): Promise<T> {
  const response = await fetch(`/api/marketplace${path}`, {
    ...init,
    headers: { ...init?.headers, ...(session ? { authorization: `Bearer ${session.token}` } : {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The request failed.');
  return body as T;
}
async function provider(): Promise<EIP1193Provider> {
  if (!walletProvider) throw new Error('Connect your wallet with Privy first.');
  return walletProvider();
}
export async function signIn(wallet: Address): Promise<WalletSession> {
  const challenge = await api<{ id: string; message: string }>('/auth/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet }),
  });
  const client = createWalletClient({
    account: wallet,
    chain: marketplaceChain,
    transport: custom(await provider()),
  });
  const signature = await client.signMessage({ message: challenge.message });
  return api<WalletSession>('/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: challenge.id, signature }),
  });
}
async function transaction(
  wallet: Address,
  address: Address,
  abi: Parameters<typeof browserPublicClient.simulateContract>[0]['abi'],
  functionName: string,
  args: readonly unknown[] = [],
) {
  if (!marketplaceReady) throw new Error('The marketplace deployment is unavailable.');
  const client = createWalletClient({
    account: wallet,
    chain: marketplaceChain,
    transport: custom(await provider()),
  });
  const [current] = await client.getAddresses();
  if (current?.toLowerCase() !== wallet.toLowerCase())
    throw new Error('The connected wallet changed. Connect again.');
  const simulated = await browserPublicClient.simulateContract({
    account: wallet,
    address,
    abi,
    functionName,
    args,
  });
  const hash = await client.writeContract(simulated.request);
  const receipt = await browserPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success')
    throw new Error('The transaction reverted. No action was completed.');
  return receipt;
}
export async function authorizeParticipant(
  wallet: Address,
  authorization: ParticipantAuthorization,
) {
  if (authorization.wallet.toLowerCase() !== wallet.toLowerCase())
    throw new Error('World authorization belongs to another wallet.');
  return transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'authorizeParticipant', [
    wallet,
    BigInt(authorization.deadline),
    authorization.signature,
  ]);
}
export async function storeMetadata(
  session: WalletSession,
  kind: 'asset' | 'slot',
  metadata: AssetMetadata | SlotMetadata,
) {
  return api<{ uri: string; hash: Hex }>(
    '/metadata',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, metadata }),
    },
    session,
  );
}
export async function uploadMedia(session: WalletSession, file: Blob, type?: string) {
  return api<{ uri: string; hash: Hex }>(
    '/media',
    { method: 'POST', headers: { 'content-type': type || file.type }, body: file },
    session,
  );
}
export async function publishAsset(wallet: Address, uri: string) {
  const receipt = await transaction(
    wallet,
    contracts.auctionHouse,
    auctionHouseAbi,
    'publishAsset',
    [uri],
  );
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contracts.auctionHouse.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: auctionHouseAbi, data: log.data, topics: log.topics });
      if (event.eventName === 'AssetPublished') return String(event.args.assetId);
    } catch {
      /* Other events are emitted in the same transaction. */
    }
  }
  throw new Error('Asset publication confirmed, but its ID was not found. Reload the marketplace.');
}
export const createSlot = (wallet: Address, assetId: string, uri: string) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'createSlot', [
    BigInt(assetId),
    uri,
  ]);
export const createCampaign = (
  wallet: Address,
  slotId: string,
  terms: {
    bidStart: bigint;
    bidEnd: bigint;
    displayStart: bigint;
    displayEnd: bigint;
    minIncreaseBps: number;
    escrowBps: number;
  },
) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'createCampaign', [
    BigInt(slotId),
    terms,
  ]);
export const approveAdvertising = (wallet: Address, amount: bigint) =>
  transaction(wallet, contracts.usdc, erc20Abi, 'approve', [contracts.auctionHouse, amount]);
export const placeAdvertisingBid = (
  wallet: Address,
  id: string,
  amount: bigint,
  artwork: { uri: string; hash: Hex },
) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'bid', [
    BigInt(id),
    amount,
    artwork.uri,
    artwork.hash,
  ]);
export const finalizeCampaign = (wallet: Address, id: string) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'finalize', [BigInt(id)]);
export const withdrawOutbid = (wallet: Address) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'withdrawOutbid');
export const faucet = (wallet: Address) =>
  transaction(wallet, contracts.usdc, demoUSDCAbi, 'faucet');
export const completeZeroEscrow = (wallet: Address, id: string) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'completeWithoutEscrow', [
    BigInt(id),
  ]);
export const refundEscrow = (wallet: Address, id: string) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'refundEscrow', [BigInt(id)]);
export const releaseEscrow = (wallet: Address, proof: ProofAuthorization) =>
  transaction(wallet, contracts.auctionHouse, auctionHouseAbi, 'releaseProof', [
    BigInt(proof.campaignId),
    proof.proofHash,
    BigInt(proof.deadline),
    proof.signature,
  ]);
export const raiseCapital = (wallet: Address, assetId: string, terms: unknown, launch: unknown) =>
  transaction(wallet, contracts.launchCoordinator, assetLaunchCoordinatorAbi, 'createLaunch', [
    BigInt(assetId),
    terms,
    launch,
  ]);
export const migrateLaunch = (wallet: Address, assetId: string) =>
  transaction(
    wallet,
    contracts.launchCoordinator,
    assetLaunchCoordinatorAbi,
    'migrateAndActivate',
    [BigInt(assetId)],
  );
export const activateMigratedLaunch = (wallet: Address, assetId: string, positionId: string) =>
  transaction(
    wallet,
    contracts.launchCoordinator,
    assetLaunchCoordinatorAbi,
    'activateMigratedLaunch',
    [BigInt(assetId), BigInt(positionId)],
  );
export const setSlotArtwork = (wallet: Address, resolver: Address, dnsName: Hex, uri: string) =>
  transaction(
    wallet,
    resolver,
    parseAbi(['function setText(bytes name,string key,string value)']),
    'setText',
    [dnsName, 'ad.artwork', uri],
  );
export const redeemShares = (wallet: Address, token: Address, amount: bigint) =>
  transaction(wallet, token, assetRevenueVaultAbi, 'redeem', [amount]);
export const approvePermit2Token = (wallet: Address, token: Address, amount: bigint) =>
  transaction(wallet, token, erc20Abi, 'approve', [contracts.permit2, amount]);
export const approvePermit2Spender = (
  wallet: Address,
  token: Address,
  spender: Address,
  amount: bigint,
) =>
  transaction(wallet, contracts.permit2, permit2Abi, 'approve', [
    token,
    spender,
    amount,
    BigInt(Math.floor(Date.now() / 1000) + 1800),
  ]);
export const submitCCABid = (wallet: Address, auction: Address, price: bigint, budget: bigint) =>
  transaction(wallet, auction, ccaAbi, 'submitBid', [price, budget, wallet, '0x']);
export const checkpointCCA = (wallet: Address, auction: Address) =>
  transaction(wallet, auction, ccaAbi, 'checkpoint');
export const sweepUnsoldTokens = (wallet: Address, auction: Address) =>
  transaction(wallet, auction, ccaAbi, 'sweepUnsoldTokens');
export const recoverFailedLaunch = (wallet: Address, auction: Address) =>
  transaction(
    wallet,
    contracts.lbpStrategy,
    parseAbi(['function migrate(address initializer)']),
    'migrate',
    [auction],
  );
export const exitCCABid = (wallet: Address, auction: Address, id: string) =>
  transaction(wallet, auction, ccaAbi, 'exitBid', [BigInt(id)]);
export const exitPartialCCABid = (
  wallet: Address,
  auction: Address,
  id: string,
  last: bigint,
  outbid: bigint,
) => transaction(wallet, auction, ccaAbi, 'exitPartiallyFilledBid', [BigInt(id), last, outbid]);
export const claimCCATokens = (wallet: Address, auction: Address, id: string) =>
  transaction(wallet, auction, ccaAbi, 'claimTokens', [BigInt(id)]);
export async function executeTrade(wallet: Address, quote: TradeQuote) {
  if (quote.deadline <= Date.now() / 1000)
    throw new Error('This quote has expired. Get a fresh quote.');
  const client = createWalletClient({
    account: wallet,
    chain: marketplaceChain,
    transport: custom(await provider()),
  });
  const hash = await client.sendTransaction({ to: universalRouter, data: encodeTrade(quote) });
  const receipt = await browserPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The trade reverted. Refresh its quote.');
  return receipt;
}
