import type { AssetKind, HumanPresetId } from './types';

// The headline and 3D scene share one sequence so their transitions stay together.
export const heroSpaces: {
  phrase: string;
  label: string;
  kind: AssetKind;
  humanPreset?: HumanPresetId;
}[] = [
  { phrase: 'An outfit.', label: 'T-shirt', kind: 'dress' },
  { phrase: 'A creator.', label: 'Person', kind: 'dress', humanPreset: 'male-casual' },
  { phrase: 'A carry-on.', label: 'Carry-on', kind: 'suitcase' },
  { phrase: 'A billboard.', label: 'Billboard', kind: 'billboard' },
  { phrase: 'A bicycle.', label: 'Bicycle', kind: 'bicycle' },
  { phrase: 'A livestream.', label: 'Livestream', kind: 'twitch' },
];
