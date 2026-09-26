import { requireSession } from '@/lib/marketplace/server/auth';
import { storeMedia, validateMetadata } from '@/lib/marketplace/server/media';
import { assertSameOrigin, readJSON, failure, RequestError } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    const body = await readJSON(request);
    if (!body.metadata || typeof body.metadata !== 'object')
      throw new RequestError('Metadata is required.');
    const metadata = validateMetadata(body.kind, body.metadata as Record<string, unknown>);
    return Response.json(
      await storeMedia(Buffer.from(JSON.stringify(metadata)), 'application/json', wallet),
    );
  } catch (error) {
    return failure(error);
  }
}
