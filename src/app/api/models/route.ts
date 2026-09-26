import { assertLocalRequest, listModels } from '@/lib/server/storage';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return Response.json(
      { models: await listModels() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'Your saved models could not be loaded.' }, { status: 400 });
  }
}
