import { loadMedia } from '@/lib/marketplace/server/media';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  context: RouteContext<'/api/marketplace/media/[hash]'>,
) {
  try {
    const { hash } = await context.params;
    const { buffer, type } = await loadMedia(hash);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
