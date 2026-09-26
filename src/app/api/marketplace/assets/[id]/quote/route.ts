import { quoteTrade } from '@/lib/marketplace/server/trading';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/assets/[id]/quote'>,
) {
  try {
    const { id } = await context.params;
    const p = new URL(request.url).searchParams;
    return Response.json(
      await quoteTrade(
        id,
        p.get('side') || '',
        p.get('amount') || '',
        Number(p.get('slippageBps') || '50'),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
