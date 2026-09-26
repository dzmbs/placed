import { requireSession } from '@/lib/marketplace/server/auth';
import { createWorldRequest } from '@/lib/marketplace/server/world';
import { assertSameOrigin, failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(createWorldRequest(requireSession(request)));
  } catch (error) {
    return failure(error);
  }
}
