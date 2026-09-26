import { randomUUID } from 'node:crypto';
import { assertLocalRequest, saveJob } from '@/lib/server/storage';
import { createGeneration } from '@/lib/server/providers';
import type { GenerationJob, GenerationProvider } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 180;
let active = 0;
const requests: number[] = [];
export async function POST(request: Request) {
  let acquired = false;
  try {
    assertLocalRequest(request);
    if (process.env.GENERATION_ENABLED !== 'true')
      throw new Error('AI generation is disabled in the local environment.');
    if (Number(request.headers.get('content-length') ?? 0) > 25 * 1024 * 1024)
      throw new Error('Keep your image upload below 24 MB total.');
    const form = await request.formData();
    const provider = form.get('provider') as GenerationProvider;
    if (!['tripo', 'meshy'].includes(provider)) throw new Error('Choose Tripo or Meshy.');
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (
      !files.length ||
      files.length > 4 ||
      files.some(
        (f) => !['image/png', 'image/jpeg'].includes(f.type) || f.size > 8 * 1024 * 1024,
      ) ||
      files.reduce((n, f) => n + f.size, 0) > 24 * 1024 * 1024
    )
      throw new Error('Use 1–4 JPG or PNG photos, at most 8 MB each and 24 MB total.');
    if (active >= 2) throw new Error('Two uploads are already being submitted. Please wait.');
    const now = Date.now();
    while (requests[0] && requests[0] < now - 3_600_000) requests.shift();
    if (requests.length >= 10)
      throw new Error('The local limit is 10 generation submissions per hour.');
    active++;
    acquired = true;
    requests.push(now);
    let providerTaskId = await createGeneration(provider, files);
    if (provider === 'meshy' && files.length > 1) providerTaskId = `multi:${providerTaskId}`;
    const job: GenerationJob = {
      id: randomUUID(),
      provider,
      providerTaskId,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      name: String(form.get('name') || files[0].name.replace(/\.[^.]+$/, '')).slice(0, 80),
    };
    await saveJob(job);
    return Response.json(
      { id: job.id, status: job.status, progress: job.progress },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation could not be started.' },
      { status: 400 },
    );
  } finally {
    if (acquired) active--;
  }
}
