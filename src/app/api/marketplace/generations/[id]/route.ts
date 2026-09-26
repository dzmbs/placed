import { requireSession } from '@/lib/marketplace/server/auth';
import { failure, RequestError } from '@/lib/marketplace/server/http';
import { database } from '@/lib/marketplace/server/database';
import { storeMedia } from '@/lib/marketplace/server/media';
import { getJob, saveJob, getAsset } from '@/lib/server/storage';
import { pollGeneration } from '@/lib/server/providers';
import type { GenerationJob } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 180;
const inflight = new Map<string, Promise<GenerationJob>>();
const polls = new Map<string, number>();
export async function GET(
  request: Request,
  context: RouteContext<'/api/marketplace/generations/[id]'>,
) {
  try {
    const wallet = requireSession(request);
    const { id } = await context.params;
    const owner = database().prepare('SELECT wallet FROM generations WHERE id = ?').get(id) as
      { wallet: string } | undefined;
    if (!owner || owner.wallet !== wallet.toLowerCase())
      throw new RequestError('Generation not found.', 404);
    let job = await getJob(id);
    if (!['succeeded', 'failed'].includes(job.status)) {
      let pending = inflight.get(id);
      if (!pending && Date.now() - (polls.get(id) || 0) > 4500) {
        polls.set(id, Date.now());
        pending = pollGeneration(job)
          .then(async (next) => {
            await saveJob(next);
            return next;
          })
          .finally(() => inflight.delete(id));
        inflight.set(id, pending);
      }
      if (pending) job = await pending;
    }
    if (job.status === 'succeeded' && job.assetUrl?.startsWith('/api/assets/')) {
      const buffer = await getAsset(job.assetUrl.split('/').pop()!);
      job.assetUrl = (await storeMedia(buffer, 'model/gltf-binary', wallet)).uri;
      await saveJob(job);
      polls.delete(id);
    }
    return Response.json({
      id,
      status: job.status,
      progress: job.progress,
      assetUrl: job.assetUrl,
      error:
        job.status === 'failed'
          ? 'The model could not be generated. Try a cleaner photo or select the prepared example.'
          : undefined,
    });
  } catch (error) {
    return failure(error);
  }
}
