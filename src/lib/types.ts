export type AssetKind = 'suitcase' | 'backpack' | 'dress' | 'bicycle' | 'digital' | 'custom';
export type HumanPresetId =
  | 'male-casual'
  | 'male-athletic'
  | 'male-casual-shorts'
  | 'male-athletic-jeans'
  | 'male-shirtless'
  | 'male-shirtless-jeans'
  | 'female-gown'
  | 'female-athletic'
  | 'female-casual'
  | 'female-ivory';
export type Vec3 = [number, number, number];
export interface Spot {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  width: number;
  height: number;
  price: number;
  artwork?: string;
  meshName?: string;
  projection?: boolean;
}
export interface Campaign {
  title: string;
  event: string;
  startDate: string;
  endDate: string;
  auctionEnd: string;
  deliverables: string;
}
export interface Draft {
  version: 1;
  asset: AssetKind;
  assetUrl?: string;
  assetName?: string;
  humanPreset?: HumanPresetId;
  color: string;
  spots: Spot[];
  campaign: Campaign;
}
export type GenerationProvider = 'tripo' | 'meshy';
export interface SavedModel {
  id: string;
  assetUrl: string;
  name: string;
  createdAt: string;
  size: number;
  source: 'upload' | GenerationProvider;
}
export interface GenerationJob {
  id: string;
  provider: GenerationProvider;
  providerTaskId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  createdAt: string;
  name: string;
  assetUrl?: string;
  error?: string;
}
