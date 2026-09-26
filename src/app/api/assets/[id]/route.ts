import { getAsset, assertLocalRequest } from '@/lib/server/storage';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const buffer = await getAsset((await params).id);
    const download = new URL(request.url).searchParams.has('download');
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=31536000, immutable',
        ...(download ? { 'Content-Disposition': 'attachment; filename="placed-model.glb"' } : {}),
      },
    });
  } catch {
    return Response.json({ error: 'Model not found.' }, { status: 404 });
  }
}
