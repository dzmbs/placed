import type { HumanPresetId, Spot } from './types';

export const HUMAN_PRESETS: {
  id: HumanPresetId;
  gender: 'male' | 'female';
  name: string;
  label: string;
}[] = [
  { id: 'male-casual', gender: 'male', name: 'Everyday / male', label: 'T-shirt & jeans' },
  { id: 'male-athletic', gender: 'male', name: 'The running kit', label: 'Running shirt & shorts' },
  {
    id: 'male-casual-shorts',
    gender: 'male',
    name: 'Cotton shirt & shorts',
    label: 'Cotton shirt & shorts',
  },
  {
    id: 'male-athletic-jeans',
    gender: 'male',
    name: 'Technical shirt & jeans',
    label: 'Technical shirt & jeans',
  },
  {
    id: 'male-shirtless',
    gender: 'male',
    name: 'The athlete',
    label: 'Shirtless & running shorts',
  },
  {
    id: 'male-shirtless-jeans',
    gender: 'male',
    name: 'Shirtless & jeans',
    label: 'Shirtless & jeans',
  },
  { id: 'female-gown', gender: 'female', name: 'The long gown', label: 'Long ivory gown' },
  {
    id: 'female-athletic',
    gender: 'female',
    name: 'The female athlete',
    label: 'Athletic top & leggings',
  },
  { id: 'female-casual', gender: 'female', name: 'Everyday / female', label: 'T-shirt & jeans' },
  { id: 'female-ivory', gender: 'female', name: 'The ivory gown', label: 'Original ivory gown' },
];
export function isHumanPreset(value: unknown): value is HumanPresetId {
  return HUMAN_PRESETS.some((preset) => preset.id === value);
}
export function humanModelUrl(id: HumanPresetId) {
  return `/models/humans/${id}.glb`;
}
export interface HumanWardrobe {
  bodyUrl: string;
  outfitUrls: string[];
  hiddenBodyMeshes: readonly string[];
  hiddenOutfitMeshes: readonly string[];
}
export type MaleTop = 'cotton' | 'technical' | 'none';
export type MaleBottom = 'jeans' | 'shorts';
export const MALE_TOPS: { id: MaleTop; label: string }[] = [
  { id: 'cotton', label: 'Cotton T-shirt' },
  { id: 'technical', label: 'Technical T-shirt' },
  { id: 'none', label: 'Shirtless' },
];
export const MALE_BOTTOMS: { id: MaleBottom; label: string }[] = [
  { id: 'jeans', label: 'Jeans' },
  { id: 'shorts', label: 'Running shorts' },
];
const malePresets: Record<MaleTop, Record<MaleBottom, HumanPresetId>> = {
  cotton: { jeans: 'male-casual', shorts: 'male-casual-shorts' },
  technical: { jeans: 'male-athletic-jeans', shorts: 'male-athletic' },
  none: { jeans: 'male-shirtless-jeans', shorts: 'male-shirtless' },
};
const maleLooks = new Map<HumanPresetId, { top: MaleTop; bottom: MaleBottom }>();
for (const top of MALE_TOPS)
  for (const bottom of MALE_BOTTOMS) {
    maleLooks.set(malePresets[top.id][bottom.id], { top: top.id, bottom: bottom.id });
  }
export function malePresetFor(top: MaleTop, bottom: MaleBottom): HumanPresetId {
  return malePresets[top][bottom];
}
export function maleLook(id?: HumanPresetId) {
  return id ? maleLooks.get(id) : undefined;
}
const outfitUrls = [
  '/models/humans/male-casual-outfit.glb?v=4',
  '/models/humans/male-athletic-outfit.glb?v=4',
];
const MALE_WARDROBES: Partial<Record<HumanPresetId, HumanWardrobe>> = {};
for (const top of MALE_TOPS)
  for (const bottom of MALE_BOTTOMS) {
    MALE_WARDROBES[malePresetFor(top.id, bottom.id)] = {
      bodyUrl: '/models/humans/male-athletic-body.glb?v=4',
      outfitUrls,
      hiddenBodyMeshes: [
        'body-under-bottom',
        'body-under-shoes',
        ...(top.id === 'none' ? [] : ['body-under-top']),
        ...(bottom.id === 'jeans' ? ['body-under-jeans'] : []),
      ],
      hiddenOutfitMeshes: [
        ...(top.id === 'none'
          ? ['shirt', 'sport-shirt']
          : [top.id === 'cotton' ? 'sport-shirt' : 'shirt']),
        bottom.id === 'jeans' ? 'shorts' : 'jeans',
      ],
    };
  }
export const FEMALE_LOOKS = [
  { id: 'female-gown', label: 'Long ivory gown', coverage: 4, garments: ['female-dress'] },
  {
    id: 'female-athletic',
    label: 'Athletic top & leggings',
    coverage: 2,
    garments: ['female-sport-top', 'female-leggings'],
  },
  {
    id: 'female-casual',
    label: 'T-shirt & jeans',
    coverage: 1,
    garments: ['female-shirt', 'female-jeans'],
  },
] as const;
const femaleRegions = [0, 1, 3, 5, 7];
const femaleGarments = [
  'female-shirt',
  'female-jeans',
  'female-sport-top',
  'female-leggings',
  'female-dress',
];
const FEMALE_WARDROBES: Partial<Record<HumanPresetId, HumanWardrobe>> = {};
for (const look of FEMALE_LOOKS) {
  FEMALE_WARDROBES[look.id] = {
    bodyUrl: '/models/humans/female-shared-body.glb?v=1',
    outfitUrls: [
      '/models/humans/female-casual-outfit.glb?v=1',
      '/models/humans/female-athletic-outfit.glb?v=1',
      '/models/humans/female-gown-outfit.glb?v=1',
    ],
    hiddenBodyMeshes: [
      'female-under-shoes',
      ...(look.coverage === 4 ? ['female-sneakers'] : []),
      ...femaleRegions
        .filter((region) => region & look.coverage)
        .map((region) => `female-skin-${region}`),
    ],
    hiddenOutfitMeshes: femaleGarments.filter(
      (garment) => !(look.garments as readonly string[]).includes(garment),
    ),
  };
}
export function humanWardrobe(id: HumanPresetId): HumanWardrobe | undefined {
  return MALE_WARDROBES[id] ?? FEMALE_WARDROBES[id];
}
export interface AvailableHuman {
  id: HumanPresetId;
  spots: Spot[];
  thumbnail: string;
}
