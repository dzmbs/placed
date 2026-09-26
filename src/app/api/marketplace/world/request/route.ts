import { requireSession } from '@/lib/marketplace/server/auth';
import { createWorldRequest } from '@/lib/marketplace/server/world';
import { assertSameOrigin, failure, readJSON } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    const body = request.headers.get('content-type')?.includes('application/json')
      ? await readJSON(request, 1024)
      : {};
    return Response.json(createWorldRequest(wallet, body.fresh === true));
  } catch (error) {
    return failure(error);
  }
}
