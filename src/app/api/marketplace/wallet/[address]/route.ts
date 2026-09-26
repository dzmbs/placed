import { walletAddress } from '@/lib/marketplace/server/auth';
import { latestBlock, minimumBlock } from '@/lib/marketplace/server/chain';
import { marketSnapshot } from '@/lib/marketplace/server/snapshot';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/wallet/[address]'>,
) {
  try {
    const { address } = await context.params;
    const minimum = minimumBlock(request);
    const block = await latestBlock(minimum);
    const snapshot = await marketSnapshot(block, walletAddress(address), minimum);
    return Response.json(snapshot.wallet, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
