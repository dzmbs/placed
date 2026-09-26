import { requireSession } from '@/lib/marketplace/server/auth';
import { checkProof, existingProof } from '@/lib/marketplace/server/proof';
import { assertSameOrigin, readBody, failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function POST(
  request: Request,
  context: RouteContext<'/api/marketplace/campaigns/[id]/proof'>,
) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    const { id } = await context.params;
    const photo = await readBody(request, 10 * 1024 * 1024);
    return Response.json(
      await checkProof(id, wallet, photo, request.headers.get('content-type') || ''),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/campaigns/[id]/proof'>,
) {
  try {
    const wallet = requireSession(request);
    const { id } = await context.params;
    return Response.json({ proof: await existingProof(id, wallet) });
  } catch (error) {
    return failure(error);
  }
}
