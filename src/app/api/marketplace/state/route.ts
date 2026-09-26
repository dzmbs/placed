import { walletAddress } from '@/lib/marketplace/server/auth';
import { latestBlock, minimumBlock } from '@/lib/marketplace/server/chain';
import { marketSnapshot } from '@/lib/marketplace/server/snapshot';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get('wallet');
    const wallet = value ? walletAddress(value) : undefined;
    const minimum = minimumBlock(request);
    const block = await latestBlock(minimum);
    return Response.json(await marketSnapshot(block, wallet, minimum), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
