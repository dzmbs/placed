import { getJob, saveJob, assertLocalRequest } from '@/lib/server/storage';
import { pollGeneration } from '@/lib/server/providers';
import type { GenerationJob } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 180;
const inflight = new Map<string, Promise<GenerationJob>>();
const lastPoll = new Map<string, number>();
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await params;
    let job = await getJob(id);
    if (!['succeeded', 'failed'].includes(job.status)) {
      let pending = inflight.get(id);
      if (!pending && Date.now() - (lastPoll.get(id) ?? 0) > 3500) {
        lastPoll.set(id, Date.now());
        pending = pollGeneration(job)
          .then(async (updated) => {
            await saveJob(updated);
            return updated;
          })
          .finally(() => inflight.delete(id));
        inflight.set(id, pending);
      }
      if (pending) job = await pending;
      if (['succeeded', 'failed'].includes(job.status)) lastPoll.delete(id);
    }
    return Response.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      assetUrl: job.assetUrl,
      name: job.name,
      error: job.error,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation could not be checked.' },
      { status: 400 },
    );
  }
}
