import type { Address, Hex } from 'viem';
import type { AssetKind, HumanPresetId, Spot } from '../types';

export interface Creator {
  wallet: Address;
}
export interface AssetMetadata {
  version: 1;
  title: string;
  description: string;
  kind: AssetKind;
  modelUrl?: string;
  humanPreset?: HumanPresetId;
  color: string;
  photos: string[];
}
export interface SlotMetadata {
  version: 1;
  name: string;
  placement: Spot;
}
export interface Asset {
  id: string;
  creator: Creator;
  metadataURI: string;
  metadata?: AssetMetadata;
  ensName: string;
  slots: AdSlot[];
  financing?: AssetFinancing;
}
export interface AdSlot {
  id: string;
  assetId: string;
  metadataURI: string;
  metadata?: SlotMetadata;
  ensName: string;
  resolver: Address;
  dnsName: Hex;
  publicArtwork?: string;
  campaign?: AdvertisingCampaign;
}
export type CampaignState = 'bidding' | 'displaying' | 'completed' | 'no-sale' | 'refunded';
export interface AdvertisingCampaign {
  id: string;
  slotId: string;
  state: CampaignState;
  bidStart: number;
  bidEnd: number;
  displayStart: number;
  displayEnd: number;
  minIncreaseBps: number;
  escrowBps: number;
  revenueBps: number;
  financingSeries?: Address;
  bidder?: Address;
  bid: string;
  minimumBid: string;
  held: string;
  winningArtworkURI: string;
  winningArtworkHash: Hex;
}
export interface AssetFinancing {
  token: Address;
  auction: Address;
  activated: boolean;
  name: string;
  symbol: string;
  totalSupply: string;
  initialSupply: string;
  revenueBps: number;
  termStart: number;
  termEnd: number;
  accountedRevenue: string;
  unresolvedCampaigns: string;
  auctionSupply: string;
  liquiditySupply: string;
  liquidityCurrencyMps: number;
  migrationBlock: string;
  migrationAttempted: boolean;
  positionId: string;
  poolId: Hex;
  liquidityOwner: Address;
}
export interface ParticipantAuthorization {
  wallet: Address;
  deadline: number;
  signature: Hex;
}
export interface ProofAuthorization {
  campaignId: string;
  proofHash: Hex;
  deadline: number;
  signature: Hex;
}
export interface ProofResult {
  outcome: 'match' | 'no-match' | 'inconclusive';
  explanation: string;
  photoURI: string;
  photoHash: Hex;
  authorization?: ProofAuthorization;
}
