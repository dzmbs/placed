import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { keccak256, type Address, type Hex } from 'viem';
import { database } from './database';
import { RequestError } from './http';
import type { AssetMetadata, SlotMetadata } from '../domain';
import { isHumanPreset } from '@/lib/humans';
import { validateGlb } from '@/lib/server/storage';

const root = path.join(process.cwd(), 'data', 'marketplace-media');
export function mediaHash(uri: string): Hex | undefined {
  try {
    const url = new URL(uri, 'http://local');
    const origin = new URL((process.env.APP_ORIGIN || 'http://127.0.0.1:3000').split(',')[0].trim())
      .origin;
    if (url.origin !== 'http://local' && url.origin !== origin) return;
    const match = /^\/api\/marketplace\/media\/(0x[a-f0-9]{64})$/.exec(url.pathname);
    return match?.[1] as Hex | undefined;
  } catch {
    return;
  }
}
export function validateImage(buffer: Buffer, type: string) {
  const valid =
    (type === 'image/png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (type === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ||
    (type === 'image/webp' &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP');
  if (!valid || buffer.length < 20) throw new RequestError('Upload a PNG, JPEG or WebP image.');
}
export async function storeMedia(buffer: Buffer, type: string, owner: Address) {
  let extension: string;
  if (['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
    validateImage(buffer, type);
    extension = type.split('/')[1];
  } else if (type === 'model/gltf-binary') {
    validateGlb(buffer);
    extension = 'glb';
  } else if (type === 'application/json') {
    JSON.parse(buffer.toString('utf8'));
    extension = 'json';
  } else throw new RequestError('Unsupported media type.');
  const hash = keccak256(buffer);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, `${hash}.${extension}`), buffer, { mode: 0o600 });
  database()
    .prepare('INSERT OR IGNORE INTO media(hash,type,extension,owner) VALUES(?,?,?,?)')
    .run(hash, type, extension, owner.toLowerCase());
  const origin = (process.env.APP_ORIGIN || 'http://127.0.0.1:3000').split(',')[0].trim();
  return { uri: `${origin}/api/marketplace/media/${hash}`, hash, type };
}
export async function loadMedia(hash: string) {
  if (!/^0x[a-f0-9]{64}$/.test(hash)) throw new RequestError('Media not found.', 404);
  const row = database().prepare('SELECT type,extension FROM media WHERE hash = ?').get(hash) as
    { type: string; extension: string } | undefined;
  if (!row) throw new RequestError('Media not found.', 404);
  const buffer = await readFile(path.join(root, `${hash}.${row.extension}`));
  if (keccak256(buffer) !== hash)
    throw new RequestError('Stored media failed its integrity check.', 500);
  return { buffer, type: row.type };
}
export async function localMetadata<T>(uri: string): Promise<T | undefined> {
  const hash = mediaHash(uri);
  if (!hash) return;
  const { buffer, type } = await loadMedia(hash);
  if (type !== 'application/json') return;
  return JSON.parse(buffer.toString('utf8')) as T;
}
function text(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new RequestError('Invalid listing text.');
  return value.trim();
}
function storedReference(value: unknown): string {
  const uri = text(value, 2048);
  if (
    !mediaHash(uri) &&
    !/^\/models\/[a-z0-9/_.-]+\.glb$/.test(uri) &&
    !/^\/api\/assets\/[a-f0-9-]{36}$/.test(uri)
  )
    throw new RequestError('Use a model or image uploaded to this application.');
  return uri;
}
export function validateMetadata(
  kind: unknown,
  input: Record<string, unknown>,
): AssetMetadata | SlotMetadata {
  if (kind === 'asset') {
    const allowed = ['suitcase', 'backpack', 'dress', 'bicycle', 'digital', 'custom'];
    if (!allowed.includes(String(input.kind)) || !/^#[a-fA-F0-9]{6}$/.test(String(input.color)))
      throw new RequestError('Invalid model or color.');
    if (
      !Array.isArray(input.photos) ||
      input.photos.length > 5 ||
      (input.humanPreset !== undefined && !isHumanPreset(input.humanPreset))
    )
      throw new RequestError('Invalid asset images or preset.');
    return {
      version: 1,
      title: text(input.title, 100),
      description: text(input.description, 2000, false),
      kind: input.kind as AssetMetadata['kind'],
      color: String(input.color),
      modelUrl: input.modelUrl ? storedReference(input.modelUrl) : undefined,
      humanPreset: input.humanPreset as AssetMetadata['humanPreset'],
      photos: input.photos.map(storedReference),
    };
  }
  if (kind !== 'slot' || !input.placement || typeof input.placement !== 'object')
    throw new RequestError('Invalid metadata type.');
  const spot = input.placement as Record<string, unknown>;
  function vector(value: unknown): [number, number, number] {
    if (
      !Array.isArray(value) ||
      value.length !== 3 ||
      !value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100)
    )
      throw new RequestError('Invalid placement transform.');
    return value as [number, number, number];
  }
  if (
    typeof spot.width !== 'number' ||
    typeof spot.height !== 'number' ||
    !Number.isFinite(spot.width) ||
    !Number.isFinite(spot.height) ||
    spot.width <= 0 ||
    spot.height <= 0 ||
    spot.width > 20 ||
    spot.height > 20
  )
    throw new RequestError('Invalid placement dimensions.');
  const name = text(input.name, 100);
  return {
    version: 1,
    name,
    placement: {
      id: text(spot.id, 100),
      name,
      position: vector(spot.position),
      rotation: vector(spot.rotation),
      width: spot.width,
      height: spot.height,
      price: 0,
      meshName: typeof spot.meshName === 'string' ? text(spot.meshName, 200) : undefined,
      projection: Boolean(spot.projection),
    },
  };
}
