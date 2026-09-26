import { assertLocalRequest, storeAsset } from '@/lib/server/storage';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    if (Number(request.headers.get('content-length') ?? 0) > 51 * 1024 * 1024)
      throw new Error('Models must be smaller than 50 MB.');
    const form = await request.formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith('.glb') ||
      file.size > 50 * 1024 * 1024
    )
      throw new Error('Choose a self-contained GLB smaller than 50 MB.');
    const name = file.name.replace(/\.glb$/i, '').slice(0, 80);
    return Response.json({
      assetUrl: await storeAsset(Buffer.from(await file.arrayBuffer()), { name, source: 'upload' }),
      name,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Import failed.' },
      { status: 400 },
    );
  }
}
