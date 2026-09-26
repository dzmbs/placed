import { requireSession } from '@/lib/marketplace/server/auth';
import { hasWorldVerification, participantAuthorization } from '@/lib/marketplace/server/world';
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

export async function GET(request: Request) {
  try {
    return Response.json({ verified: hasWorldVerification(requireSession(request)) });
  } catch (error) {
    return failure(error);
  }
}
