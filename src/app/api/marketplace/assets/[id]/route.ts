import { chainId, readAsset } from '@/lib/marketplace/server/reader';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  context: RouteContext<'/api/marketplace/assets/[id]'>,
) {
  try {
    const { id } = await context.params;
    return Response.json(await readAsset(chainId(id)));
  } catch (error) {
    return failure(error);
  }
}
