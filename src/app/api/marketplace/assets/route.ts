import { listAssets } from '@/lib/marketplace/server/reader';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return Response.json(await listAssets());
  } catch (error) {
    return failure(error);
  }
}
