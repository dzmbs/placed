import { randomUUID } from 'node:crypto';
import { requireSession } from '@/lib/marketplace/server/auth';
import { assertSameOrigin, readBody, failure, RequestError } from '@/lib/marketplace/server/http';
import { database } from '@/lib/marketplace/server/database';
import { validateImage } from '@/lib/marketplace/server/media';
import { saveJob } from '@/lib/server/storage';
import { createGeneration } from '@/lib/server/providers';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const wallet = requireSession(request);
    if (process.env.GENERATION_ENABLED !== 'true')
      throw new RequestError(
        'AI generation is disabled. You can select a labeled prepared example.',
        503,
      );
    const bytes = await readBody(request, 10 * 1024 * 1024);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { 'content-type': request.headers.get('content-type') || '' },
    }).formData();
    const file = form.get('photo');
    if (
      !(file instanceof File) ||
      file.size > 8 * 1024 * 1024 ||
      !['image/png', 'image/jpeg'].includes(file.type)
    )
      throw new RequestError('Use one JPG or PNG photo, up to 8 MB.');
    validateImage(Buffer.from(await file.arrayBuffer()), file.type);
    const now = Math.floor(Date.now() / 1000),
      db = database();
    const counts = db
      .prepare(
        'SELECT COUNT(*) AS total, SUM(wallet = ?) AS personal FROM generations WHERE created > ?',
      )
      .get(wallet.toLowerCase(), now - 3600) as { total: number; personal: number };
    if (counts.total >= 10 || counts.personal >= 2)
      throw new RequestError(
        'Generation is limited to two requests per wallet and ten total per hour.',
        429,
      );
    const id = randomUUID();
    db.prepare('INSERT INTO generations(id,wallet,created) VALUES(?,?,?)').run(
      id,
      wallet.toLowerCase(),
      now,
    );
    const providerTaskId = await createGeneration('tripo', [file]);
    await saveJob({
      id,
      provider: 'tripo',
      providerTaskId,
      status: 'queued',
      progress: 0,
      name: 'Uploaded outfit',
      createdAt: new Date().toISOString(),
    });
    return Response.json({ id, status: 'queued', progress: 0 }, { status: 202 });
  } catch (error) {
    return failure(error);
  }
}
