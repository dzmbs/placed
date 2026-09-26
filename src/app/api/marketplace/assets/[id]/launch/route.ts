import { readLaunch } from '@/lib/marketplace/server/launch';
import { walletAddress } from '@/lib/marketplace/server/auth';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/assets/[id]/launch'>,
) {
  try {
    const { id } = await context.params;
    const wallet = new URL(request.url).searchParams.get('wallet');
    return Response.json(await readLaunch(id, wallet ? walletAddress(wallet) : undefined));
  } catch (error) {
    return failure(error);
  }
}
