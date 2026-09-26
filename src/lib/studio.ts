import type { AssetKind, Campaign, Draft, Spot } from './types';
import { validId } from './ids';
import { isHumanPreset } from './humans';

export const ASSETS: { id: AssetKind; name: string; label: string }[] = [
  { id: 'suitcase', name: 'The carry-on', label: 'TRAVEL' },
  { id: 'backpack', name: 'The daily pack', label: 'EVERYDAY' },
  { id: 'dress', name: 'The wardrobe', label: 'APPAREL' },
  { id: 'bicycle', name: 'The road bike', label: 'SPORT' },
  { id: 'digital', name: 'The digital canvas', label: 'DIGITAL' },
];
export const COLORS = ['#b4b8ab', '#e2d9c9', '#36463e', '#25272e', '#c4cd75'];
export const DEFAULT_CAMPAIGN: Campaign = {
  title: 'Your brand, on my next adventure',
  event: 'Community conference',
  startDate: '2026-10-05',
  endDate: '2026-10-10',
  auctionEnd: '2026-10-01T18:00',
  deliverables: 'Your logo on my carry-on, 3 event photos, and one dedicated social post.',
};

export function defaultSpots(asset: AssetKind): Spot[] {
  const create = (
    id: string,
    name: string,
    position: Spot['position'],
    width: number,
    height: number,
    price: number,
    back = false,
  ): Spot => ({
    id,
    name,
    position,
    rotation: [0, back ? Math.PI : 0, 0],
    width,
    height,
    price,
  });
  if (asset === 'suitcase')
    return [
      create('front-hero', 'Front / hero', [0, 1.92, 0.445], 1.12, 0.48, 350),
      create('front-left', 'Front / lower left', [-0.32, 1.28, 0.445], 0.48, 0.45, 200),
      create('front-right', 'Front / lower right', [0.32, 1.28, 0.445], 0.48, 0.45, 200),
      create('front-bottom', 'Front / base', [0, 0.65, 0.445], 1.12, 0.4, 250),
      create('back-hero', 'Back / hero', [0, 1.78, -0.445], 1.12, 0.48, 300, true),
      create('back-bottom', 'Back / base', [0, 0.82, -0.445], 1.12, 0.5, 250, true),
    ];
  if (asset === 'backpack')
    return [
      create('pack-top', 'Front / upper', [0, 1.98, 0.47], 0.75, 0.45, 250),
      create('pack-pocket', 'Front / pocket', [0, 1.0, 0.59], 0.82, 0.55, 350),
      create('pack-low', 'Front / base', [0, 0.51, 0.5], 0.65, 0.24, 150),
      create('pack-back', 'Back / panel', [0, 1.5, -0.5], 0.8, 0.65, 250, true),
    ];
  if (asset === 'dress')
    return [
      create('dress-chest', 'Bodice / front', [0, 1.94, 0.26], 0.43, 0.3, 450),
      create('dress-hip', 'Skirt / upper', [0, 1.3, 0.285], 0.5, 0.4, 350),
      create('dress-low', 'Skirt / lower', [0, 0.59, 0.41], 0.6, 0.46, 300),
      create('dress-back', 'Bodice / back', [0, 1.91, -0.26], 0.43, 0.3, 350, true),
    ].map((spot) => ({ ...spot, projection: true, meshName: 'dress' }));
  if (asset === 'bicycle')
    return [
      {
        ...create('bike-frame', 'Frame / down tube', [0.295, 1.2, 0.065], 0.7, 0.11, 350),
        rotation: [0, 0, 0.79],
      },
      {
        ...create('bike-top', 'Frame / top tube', [0.115, 1.72, 0.045], 0.7, 0.09, 300),
        rotation: [0, 0, -0.03],
      },
      {
        ...create('bike-seat', 'Frame / seat tube', [-0.38, 1.22, 0.045], 0.09, 0.45, 200),
        rotation: [0, 0, 0.333],
      },
    ];
  if (asset === 'digital')
    return [
      create('banner-left', 'Banner / left', [-0.82, 1.6, 0.11], 0.66, 0.56, 250),
      create('banner-center', 'Banner / center', [0, 1.6, 0.11], 0.66, 0.56, 350),
      create('banner-right', 'Banner / right', [0.82, 1.6, 0.11], 0.66, 0.56, 250),
    ];
  return [];
}

export function initialDraft(): Draft {
  return {
    version: 1,
    asset: 'suitcase',
    color: COLORS[0],
    spots: defaultSpots('suitcase'),
    campaign: { ...DEFAULT_CAMPAIGN },
  };
}
export function validateDraft(draft: Draft): string[] {
  const errors: string[] = [];
  if (!draft.spots.length) errors.push('Add at least one placement.');
  if (!draft.campaign.title.trim()) errors.push('Give your campaign a title.');
  if (!draft.campaign.event.trim()) errors.push('Add an event or display location.');
  if (!draft.campaign.deliverables.trim()) errors.push('Describe what sponsors will receive.');
  if (
    !Number.isFinite(Date.parse(draft.campaign.startDate)) ||
    !Number.isFinite(Date.parse(draft.campaign.endDate)) ||
    draft.campaign.endDate < draft.campaign.startDate
  )
    errors.push('Choose a valid display date range.');
  if (
    !Number.isFinite(Date.parse(draft.campaign.auctionEnd)) ||
    new Date(draft.campaign.auctionEnd).getTime() >= new Date(draft.campaign.startDate).getTime()
  )
    errors.push('The auction must close before the display starts.');
  if (
    draft.spots.some(
      (s) =>
        !s.name.trim() ||
        !Number.isFinite(s.price) ||
        s.price < 1 ||
        !Number.isFinite(s.width) ||
        !Number.isFinite(s.height) ||
        s.width <= 0 ||
        s.height <= 0,
    )
  )
    errors.push('Each placement needs a name, positive dimensions, and a starting price.');
  if (draft.asset === 'custom' && !draft.assetUrl) errors.push('Import a model for this campaign.');
  return errors;
}
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
export function money(value: number): string {
  return currency.format(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isVector(value: unknown): value is Spot['position'] {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
function isSpot(value: unknown): value is Spot {
  if (!isRecord(value)) return false;
  const { id, name, position, rotation, width, height, price, artwork, meshName, projection } =
    value;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof name === 'string' &&
    isVector(position) &&
    isVector(rotation) &&
    typeof width === 'number' &&
    Number.isFinite(width) &&
    width >= 0.05 &&
    width <= 5 &&
    typeof height === 'number' &&
    Number.isFinite(height) &&
    height >= 0.05 &&
    height <= 5 &&
    typeof price === 'number' &&
    Number.isFinite(price) &&
    price >= 0 &&
    (artwork === undefined ||
      (typeof artwork === 'string' &&
        artwork.length <= 3_000_000 &&
        /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(artwork))) &&
    (meshName === undefined || typeof meshName === 'string') &&
    (projection === undefined || typeof projection === 'boolean')
  );
}
const campaignFields: (keyof Campaign)[] = [
  'title',
  'event',
  'startDate',
  'endDate',
  'auctionEnd',
  'deliverables',
];
export function safeDraft(value: unknown): Draft | null {
  if (!isRecord(value)) return null;
  const { version, asset, color, spots, campaign, assetUrl, assetName, humanPreset } = value;
  if (version !== 1 || ![...ASSETS.map((a) => a.id), 'custom'].includes(asset as AssetKind))
    return null;
  if (typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) return null;
  if (!Array.isArray(spots) || spots.length > 100 || !spots.every(isSpot)) return null;
  if (new Set(spots.map((spot) => spot.id)).size !== spots.length) return null;
  if (!isRecord(campaign) || !campaignFields.every((key) => typeof campaign[key] === 'string'))
    return null;
  if (
    assetUrl !== undefined &&
    (typeof assetUrl !== 'string' ||
      !assetUrl.startsWith('/api/assets/') ||
      !validId(assetUrl.slice(12)))
  )
    return null;
  if (assetName !== undefined && typeof assetName !== 'string') return null;
  if (
    humanPreset !== undefined &&
    (asset !== 'dress' || !isHumanPreset(humanPreset) || assetUrl !== undefined)
  )
    return null;
  return value as unknown as Draft;
}
