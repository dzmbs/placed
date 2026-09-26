import 'server-only';
import { mkdir, readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validId } from '../ids';
import type { GenerationJob, SavedModel } from '../types';

const root = path.join(process.cwd(), 'data');
// The studio writes files and spends generation credits, so it only answers
// localhost and the deployments listed in APP_ORIGIN (the hosted frontend
// proxies /api here, so its Origin differs from this server's Host).
export function assertLocalRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host') || requestUrl.host;
  const allowed = (process.env.APP_ORIGIN || '')
    .split(',')
    .filter((value) => value.trim())
    .map((value) => new URL(value.trim()));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${host}`).hostname);
  if (!local && !allowed.some((url) => url.host === host))
    throw new Error('This studio accepts local requests only.');
  const origin = request.headers.get('origin');
  if (
    origin &&
    !(new URL(origin).host === host && new URL(origin).protocol === requestUrl.protocol) &&
    !allowed.some((url) => url.origin === new URL(origin).origin)
  )
    throw new Error('Cross-origin requests are not allowed.');
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new Error('Cross-site requests are not allowed.');
}
export function validateGlb(buffer: Buffer) {
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'glTF' ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length
  )
    throw new Error('Upload a valid binary glTF 2.0 (.glb) model.');
  if (buffer.readUInt32LE(16) !== 0x4e4f534a)
    throw new Error('The GLB is missing its model description.');
  const length = buffer.readUInt32LE(12);
  if (length > buffer.length - 20) throw new Error('The model is incomplete.');
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + length));
  const refs = [...(json.images ?? []), ...(json.buffers ?? [])];
  if (refs.some((r: { uri?: string }) => r.uri && !r.uri.startsWith('data:')))
    throw new Error('Use a self-contained GLB with embedded textures.');
}
export async function storeAsset(
  buffer: Buffer,
  metadata?: { name: string; source: SavedModel['source'] },
): Promise<string> {
  validateGlb(buffer);
  const id = randomUUID();
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'assets', `${id}.glb`), buffer);
  if (metadata)
    await writeFile(
      path.join(root, 'assets', `${id}.json`),
      JSON.stringify({ ...metadata, createdAt: new Date().toISOString() }),
    );
  return `/api/assets/${id}`;
}
export async function listModels(): Promise<SavedModel[]> {
  const assets = path.join(root, 'assets');
  let files: string[];
  try {
    files = await readdir(assets);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const recovered = new Map<string, GenerationJob>();
  let jobs: string[] = [];
  try {
    jobs = await readdir(path.join(root, 'jobs'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const file of jobs.filter((f) => f.endsWith('.json'))) {
    try {
      const job = JSON.parse(
        await readFile(path.join(root, 'jobs', file), 'utf8'),
      ) as GenerationJob;
      if (job.status === 'succeeded' && job.assetUrl) recovered.set(job.assetUrl, job);
    } catch {
      /* A corrupt job does not hide other models. */
    }
  }
  const models = await Promise.all(
    files
      .filter((file) => file.endsWith('.glb') && validId(file.slice(0, -4)))
      .map(async (file) => {
        const id = file.slice(0, -4),
          assetUrl = `/api/assets/${id}`;
        const info = await stat(path.join(assets, file));
        let meta: Partial<SavedModel> = {};
        try {
          meta = JSON.parse(await readFile(path.join(assets, `${id}.json`), 'utf8'));
        } catch {
          /* Older assets are recovered from their generation records. */
        }
        const job = recovered.get(assetUrl);
        return {
          id,
          assetUrl,
          name: typeof meta.name === 'string' ? meta.name : job?.name || 'Imported model',
          source: meta.source || job?.provider || 'upload',
          createdAt: meta.createdAt || job?.createdAt || info.birthtime.toISOString(),
          size: info.size,
        } satisfies SavedModel;
      }),
  );
  return models.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getAsset(id: string) {
  if (!validId(id)) throw new Error('Invalid asset.');
  return readFile(path.join(root, 'assets', `${id}.glb`));
}
export async function saveJob(job: GenerationJob) {
  await mkdir(path.join(root, 'jobs'), { recursive: true });
  const file = path.join(root, 'jobs', `${job.id}.json`);
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(job));
  await rename(temp, file);
}
export async function getJob(id: string): Promise<GenerationJob> {
  if (!validId(id)) throw new Error('Invalid generation.');
  return JSON.parse(await readFile(path.join(root, 'jobs', `${id}.json`), 'utf8'));
}
