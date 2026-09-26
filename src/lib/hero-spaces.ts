import type { AssetKind, HumanPresetId, Vec3 } from './types';

export type HeroPlacement = {
  id: string;
  name: string;
  format: string;
  price: string;
  booked?: boolean;
  artwork: string;
  position: Vec3;
  rotation?: Vec3;
  size: [number, number];
  label: { side: 'left' | 'right'; top: number };
};

export type ProjectPlacement = (index: number, id: string, corners: [number, number][]) => void;

// Model geometry and projected placement callouts share this sequence.
export const heroSpaces: {
  label: string;
  kind: AssetKind;
  humanPreset?: HumanPresetId;
  placements: HeroPlacement[];
}[] = [
  {
    label: 'T-shirt',
    kind: 'dress',
    placements: [
      {
        id: 'chest',
        name: 'Chest print',
        format: 'Screen print',
        price: '$450 / event',
        artwork: 'YOUR BRAND',
        position: [0.02, 0.2, 0.64],
        size: [1.05, 0.65],
        label: { side: 'right', top: 70 },
      },
      {
        id: 'sleeve',
        name: 'Sleeve patch',
        format: 'NORTH · woven patch',
        price: '$180 / event',
        booked: true,
        artwork: 'NORTH',
        position: [-1.04, 0.42, 0.27],
        rotation: [0, -0.35, -0.4],
        size: [0.37, 0.23],
        label: { side: 'left', top: 8 },
      },
    ],
  },
  {
    label: 'Person',
    kind: 'dress',
    humanPreset: 'male-casual',
    placements: [
      {
        id: 'creator-chest',
        name: 'Shirt front',
        format: 'Title sponsor',
        price: '$600 / event',
        artwork: 'YOUR BRAND',
        position: [0, 2.03, 0.075],
        size: [0.46, 0.3],
        label: { side: 'left', top: 16 },
      },
      {
        id: 'creator-leg',
        name: 'Left leg',
        format: 'PACE · fabric patch',
        price: '$200 / event',
        booked: true,
        artwork: 'PACE',
        position: [0.2, 1.3, 0.015],
        size: [0.21, 0.23],
        label: { side: 'right', top: 66 },
      },
    ],
  },
  {
    label: 'Carry-on',
    kind: 'suitcase',
    placements: [
      {
        id: 'front-panel',
        name: 'Front panel',
        format: 'Travel sponsor',
        price: '$350 / trip',
        artwork: 'YOUR BRAND',
        position: [0, 1.92, 0.45],
        size: [1.12, 0.48],
        label: { side: 'left', top: 10 },
      },
      {
        id: 'travel-sticker',
        name: 'Travel sticker',
        format: 'ROAM · vinyl decal',
        price: '$150 / trip',
        booked: true,
        artwork: 'ROAM',
        position: [0.32, 1.28, 0.45],
        size: [0.48, 0.45],
        label: { side: 'right', top: 69 },
      },
    ],
  },
  {
    label: 'Billboard',
    kind: 'billboard',
    placements: [
      {
        id: 'main-display',
        name: 'Main display',
        format: 'Outdoor campaign',
        price: '$750 / week',
        artwork: 'YOUR BRAND HERE',
        position: [0, 2.2, 0.15],
        size: [3.04, 0.95],
        label: { side: 'left', top: 3 },
      },
      {
        id: 'sponsor-strip',
        name: 'Sponsor strip',
        format: 'LOCAL · partner banner',
        price: '$200 / week',
        booked: true,
        artwork: 'LOCAL / GOOD THINGS AHEAD',
        position: [0, 1.55, 0.15],
        size: [3.04, 0.26],
        label: { side: 'right', top: 72 },
      },
    ],
  },
  {
    label: 'Bicycle',
    kind: 'bicycle',
    placements: [
      {
        id: 'down-tube',
        name: 'Down tube',
        format: 'Frame decal',
        price: '$350 / race',
        artwork: 'YOUR BRAND',
        position: [0.295, 1.2, 0.07],
        rotation: [0, 0, 0.79],
        size: [0.7, 0.11],
        label: { side: 'right', top: 70 },
      },
      {
        id: 'top-tube',
        name: 'Top tube',
        format: 'VELO · frame decal',
        price: '$250 / race',
        booked: true,
        artwork: 'VELO',
        position: [0.115, 1.72, 0.05],
        rotation: [0, 0, -0.03],
        size: [0.7, 0.09],
        label: { side: 'left', top: 5 },
      },
    ],
  },
  {
    label: 'Livestream',
    kind: 'twitch',
    placements: [
      {
        id: 'backdrop',
        name: 'Backdrop panel',
        format: 'On-camera sponsor',
        price: '$350 / stream',
        artwork: 'YOUR BRAND',
        position: [-1.05, 1.97, -0.105],
        size: [0.95, 0.55],
        label: { side: 'left', top: 4 },
      },
      {
        id: 'desk-banner',
        name: 'Desk banner',
        format: 'PLAY · sponsor strip',
        price: '$200 / stream',
        booked: true,
        artwork: 'PLAY / MAKE YOUR MOVE',
        position: [0, 0.75, 0.88],
        size: [1.65, 0.26],
        label: { side: 'right', top: 73 },
      },
    ],
  },
];
