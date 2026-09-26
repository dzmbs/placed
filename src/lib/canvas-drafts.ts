import type { AssetKind, Draft, HumanPresetId, Spot } from './types';
import { defaultSpots, safeDraft } from './studio';

export type CanvasDrafts = Record<string, Draft>;
export function canvasKey(draft: Pick<Draft, 'asset' | 'assetUrl' | 'humanPreset'>) {
  if (draft.asset === 'custom') return `custom:${draft.assetUrl}`;
  return draft.asset === 'dress' && draft.humanPreset ? `dress:${draft.humanPreset}` : draft.asset;
}
export function rememberCanvas(saved: CanvasDrafts, draft: Draft): CanvasDrafts {
  return { ...saved, [canvasKey(draft)]: draft };
}
export function selectCanvas(
  saved: CanvasDrafts,
  current: Draft,
  asset: AssetKind,
  assetUrl?: string,
  assetName?: string,
): Draft {
  const previous = saved[canvasKey({ asset, assetUrl })];
  const next = { ...current, asset, assetUrl, assetName, spots: defaultSpots(asset) };
  delete next.humanPreset;
  return previous ?? next;
}
export function selectHuman(
  saved: CanvasDrafts,
  current: Draft,
  humanPreset: HumanPresetId,
  assetName: string,
  spots: Spot[],
): Draft {
  const next: Draft = {
    ...current,
    asset: 'dress',
    assetName,
    humanPreset,
    spots: structuredClone(spots),
  };
  delete next.assetUrl;
  return saved[canvasKey({ asset: 'dress', humanPreset })] ?? next;
}
export function safeCanvasDrafts(value: unknown): CanvasDrafts {
  const result: CanvasDrafts = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const candidate of Object.values(value)) {
    const draft = safeDraft(candidate);
    if (draft) result[canvasKey(draft)] = draft;
  }
  return result;
}
