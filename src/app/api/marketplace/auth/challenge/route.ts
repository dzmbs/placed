import { createChallenge, walletAddress } from '@/lib/marketplace/server/auth';
import { assertSameOrigin, readJSON, failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJSON(request);
    return Response.json(createChallenge(walletAddress(body.wallet)));
  } catch (error) {
    return failure(error);
  }
}
