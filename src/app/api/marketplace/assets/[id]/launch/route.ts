import { chainId } from '@/lib/marketplace/server/reader';
import { atBlock, latestBlock, minimumBlock } from '@/lib/marketplace/server/chain';
import { readLaunch } from '@/lib/marketplace/server/launch';
import { marketSnapshot } from '@/lib/marketplace/server/snapshot';
import { walletAddress } from '@/lib/marketplace/server/auth';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/assets/[id]/launch'>,
) {
  try {
    const { id } = await context.params;
    chainId(id);
    const value = new URL(request.url).searchParams.get('wallet');
    const minimum = minimumBlock(request);
    const block = await latestBlock(minimum);
    const snapshot = await marketSnapshot(block, value ? walletAddress(value) : undefined, minimum);
    const launch =
      snapshot.launches[id] ??
      (await atBlock(
        block.number,
        () => readLaunch(id, value ? walletAddress(value) : undefined, undefined, block.number),
        block.hash,
      ));
    return Response.json(launch, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
