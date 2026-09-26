import 'server-only';
import type { GenerationJob, GenerationProvider } from '../types';
import { storeAsset } from './storage';

const TRIPO = 'https://openapi.tripo3d.ai/v3';
const MESHY = 'https://api.meshy.ai/openapi/v1';
function apiKey(provider: GenerationProvider) {
  const key = process.env[provider === 'tripo' ? 'TRIPO_API_KEY' : 'MESHY_API_KEY'];
  if (!key) throw new Error(`${provider === 'tripo' ? 'Tripo' : 'Meshy'} is not configured yet.`);
  return key;
}
async function providerRequest(url: string, key: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('The generation provider could not be reached. Try again in a moment.');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error(
        'The provider rejected this API key or account access. Check the server configuration.',
      );
    if (response.status === 402)
      throw new Error('Your generation provider needs more API credits.');
    if (response.status === 429)
      throw new Error('The generation provider is busy. Try again shortly.');
    throw new Error(`The provider could not process this request (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (typeof data.code === 'number' && data.code !== 0)
    throw new Error(
      'The provider could not process the uploaded images. Check your account credits and image format.',
    );
  return data;
}
export async function createGeneration(
  provider: GenerationProvider,
  files: File[],
): Promise<string> {
  const key = apiKey(provider);
  if (provider === 'tripo') {
    const tokens: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const result = await providerRequest(`${TRIPO}/files`, key, { method: 'POST', body: form });
      if (!result.data?.file_token)
        throw new Error('The provider did not return an image upload token.');
      tokens.push(result.data.file_token);
    }
    const body =
      tokens.length === 1
        ? { input: tokens[0], model: 'v3.1-20260211', texture: true, pbr: true, face_limit: 60000 }
        : {
            inputs: tokens.map((token, i) => ({ [['front', 'back', 'left', 'right'][i]]: token })),
            model: 'v3.1-20260211',
            texture: true,
            pbr: true,
            face_limit: 60000,
          };
    const result = await providerRequest(
      `${TRIPO}/generation/${tokens.length === 1 ? 'image-to-model' : 'multiview-to-model'}`,
      key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!result.data?.task_id) throw new Error('The provider did not create a generation task.');
    return result.data.task_id;
  }
  const images: string[] = [];
  for (const file of files)
    images.push(
      `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`,
    );
  const body = {
    ...(files.length === 1 ? { image_url: images[0] } : { image_urls: images }),
    ai_model: 'meshy-7.1',
    should_texture: true,
    enable_pbr: true,
    should_remesh: true,
    target_polycount: 60000,
    target_formats: ['glb'],
  };
  const result = await providerRequest(
    `${MESHY}/${files.length === 1 ? 'image-to-3d' : 'multi-image-to-3d'}`,
    key,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!result.result) throw new Error('The provider did not create a generation task.');
  return result.result;
}
async function downloadModel(url: string, job: GenerationJob) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !/(?:^|\.)(?:tripo3d\.(?:ai|com)|tripo-data\.rio\.aws|amazonaws\.com|meshy\.ai|meshcapade\.com|cloudfront\.net)$/.test(
      parsed.hostname,
    )
  )
    throw new Error('The provider returned an unexpected asset host.');
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'error' });
  if (
    !response.ok ||
    Number(response.headers.get('content-length') ?? 0) > 100 * 1024 * 1024 ||
    !response.body
  )
    throw new Error('The generated model could not be downloaded.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 100 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('The generated model is larger than 100 MB.');
    }
    chunks.push(value);
  }
  return storeAsset(Buffer.concat(chunks), { name: job.name, source: job.provider });
}
export async function pollGeneration(job: GenerationJob): Promise<GenerationJob> {
  const key = apiKey(job.provider);
  const result = await providerRequest(
    job.provider === 'tripo'
      ? `${TRIPO}/tasks/${encodeURIComponent(job.providerTaskId)}`
      : `${MESHY}/${job.providerTaskId.startsWith('multi:') ? 'multi-image-to-3d' : 'image-to-3d'}/${encodeURIComponent(job.providerTaskId.replace(/^multi:/, ''))}`,
    key,
  );
  const task = job.provider === 'tripo' ? result.data : result;
  const status = String(task.status).toLowerCase();
  if (['failed', 'failure', 'canceled', 'cancelled', 'expired', 'banned'].includes(status))
    return {
      ...job,
      status: 'failed',
      error: 'Generation failed. Try clearer photos with an uncluttered background.',
    };
  if (['success', 'succeeded'].includes(status)) {
    const url = task.output?.model_url ?? task.output?.pbr_model ?? task.model_urls?.glb;
    if (!url) throw new Error('The generation completed without a GLB model.');
    return { ...job, status: 'succeeded', progress: 100, assetUrl: await downloadModel(url, job) };
  }
  return {
    ...job,
    status: 'running',
    progress: Math.min(99, Math.max(0, Number(task.progress) || 0)),
  };
}
