import type { IDKitResult } from '@worldcoin/idkit-core';
import { requireSession } from '@/lib/marketplace/server/auth';
import { verifyWorldRequest } from '@/lib/marketplace/server/world';
import { assertSameOrigin, readJSON, failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    const body = await readJSON(request);
    return Response.json(await verifyWorldRequest(wallet, body.result as IDKitResult));
  } catch (error) {
    return failure(error);
  }
}
