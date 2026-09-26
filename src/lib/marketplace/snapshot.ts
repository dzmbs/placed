import type { Asset, AdvertisingCampaign } from './domain';
import type { LaunchStatus } from './server/launch';

export interface MarketSnapshot {
  assets: Asset[];
  campaigns: AdvertisingCampaign[];
  events: { name: string; args: Record<string, string>; at: number; hash: string; index: number }[];
  now: number;
  launches: Record<string, LaunchStatus>;
  wallet?: {
    address: string;
    usdc: string;
    credit: string;
    authorized: boolean;
    admin: boolean;
    approvals: Record<string, string>;
    tokens: Record<string, string>;
    redemptions?: Record<string, string>;
  };
}
