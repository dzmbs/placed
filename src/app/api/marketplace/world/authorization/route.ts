import { requireSession } from '@/lib/marketplace/server/auth';
import { participantAuthorization } from '@/lib/marketplace/server/world';
import { assertSameOrigin, failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return Response.json(await participantAuthorization(requireSession(request)));
  } catch (error) {
    return failure(error);
  }
}
