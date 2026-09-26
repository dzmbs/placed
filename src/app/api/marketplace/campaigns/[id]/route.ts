import { chainId, readCampaign, readAsset } from '@/lib/marketplace/server/reader';
import { publicClient } from '@/lib/marketplace/server/chain';
import { auctionHouseAbi } from '@/lib/marketplace/abi/AuctionHouse';
import { contracts } from '@/lib/marketplace/config';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  context: RouteContext<'/api/marketplace/campaigns/[id]'>,
) {
  try {
    const { id } = await context.params;
    const campaign = await readCampaign(chainId(id));
    const slot = await publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'getSlot',
      args: [BigInt(campaign.slotId)],
    });
    return Response.json({ campaign, asset: await readAsset(slot.assetId) });
  } catch (error) {
    return failure(error);
  }
}
