import { contracts } from '@/lib/marketplace/config';
import { auctionHouseAbi } from '@/lib/marketplace/abi/AuctionHouse';
import { publicClient } from '@/lib/marketplace/server/chain';
import { readCampaign } from '@/lib/marketplace/server/reader';
import { failure, RequestError } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const count = await publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'campaignCount',
    });
    if (count > 500n) throw new RequestError('The demo indexer needs campaign pagination.', 503);
    return Response.json(
      await Promise.all(
        Array.from({ length: Number(count) }, (_, index) => readCampaign(count - BigInt(index))),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
