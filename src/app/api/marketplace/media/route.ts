import { requireSession } from '@/lib/marketplace/server/auth';
import { storeMedia } from '@/lib/marketplace/server/media';
import { assertSameOrigin, readBody, failure, RequestError } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    const type = request.headers.get('content-type')?.split(';')[0] || '';
    if (!['image/png', 'image/jpeg', 'image/webp', 'model/gltf-binary'].includes(type))
      throw new RequestError('Upload an image or self-contained GLB.');
    return Response.json(
      await storeMedia(
        await readBody(request, type === 'model/gltf-binary' ? 50 * 1024 * 1024 : 10 * 1024 * 1024),
        type,
        wallet,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
