'use client';
import { Check } from 'lucide-react';
import {
  HUMAN_PRESETS,
  FEMALE_LOOKS,
  MALE_TOPS,
  MALE_BOTTOMS,
  maleLook,
  malePresetFor,
  type AvailableHuman,
} from '@/lib/humans';
import type { HumanPresetId } from '@/lib/types';

export default function HumanPicker({
  humans,
  current,
  onSelect,
}: {
  humans: AvailableHuman[];
  current?: HumanPresetId;
  onSelect: (human: AvailableHuman) => void;
}) {
  const maleClothes = maleLook(current);
  return (
    <div className="human-picker">
      <span className="section-label">CHOOSE YOUR LOOK</span>
      <div className="segmented human-genders">
        {(['male', 'female'] as const).map((gender) => {
          const first = humans.find(
            (h) => HUMAN_PRESETS.find((p) => p.id === h.id)?.gender === gender,
          );
          const active = HUMAN_PRESETS.find((p) => p.id === current)?.gender === gender;
          return (
            <button
              key={gender}
              disabled={!first}
              aria-pressed={active}
              className={active ? 'active' : ''}
              onClick={() => first && !active && onSelect(first)}
            >
              {gender === 'male' ? 'Male' : 'Female'}
            </button>
          );
        })}
      </div>
      {maleClothes ? (
        <div className="wardrobe-controls">
          <p className="wardrobe-note">Same person. Mix your top and bottoms.</p>
          <div className="human-outfits" role="group" aria-label="Choose a top">
            <span className="section-label">TOP</span>
            {MALE_TOPS.map((top) => {
              const look = humans.find((h) => h.id === malePresetFor(top.id, maleClothes.bottom));
              const active = top.id === maleClothes.top;
              return (
                <button
                  key={top.id}
                  disabled={!look}
                  className={active ? 'chosen' : ''}
                  aria-pressed={active}
                  onClick={() => look && !active && onSelect(look)}
                >
                  <span>{top.label}</span>
                  {active && <Check size={12} />}
                </button>
              );
            })}
          </div>
          <div className="human-outfits" role="group" aria-label="Choose bottoms">
            <span className="section-label">BOTTOMS</span>
            {MALE_BOTTOMS.map((bottom) => {
              const look = humans.find((h) => h.id === malePresetFor(maleClothes.top, bottom.id));
              const active = bottom.id === maleClothes.bottom;
              return (
                <button
                  key={bottom.id}
                  disabled={!look}
                  className={active ? 'chosen' : ''}
                  aria-pressed={active}
                  onClick={() => look && !active && onSelect(look)}
                >
                  <span>{bottom.label}</span>
                  {active && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="wardrobe-controls">
          {FEMALE_LOOKS.some((look) => look.id === current) && (
            <p className="wardrobe-note">Same woman. Swap her outfit.</p>
          )}
          <div className="human-outfits">
            {humans
              .filter((h) => HUMAN_PRESETS.find((p) => p.id === h.id)?.gender === 'female')
              .map((h) => (
                <button
                  key={h.id}
                  className={current === h.id ? 'chosen' : ''}
                  aria-pressed={current === h.id}
                  onClick={() => onSelect(h)}
                >
                  <img src={h.thumbnail} alt="" />
                  <span>{HUMAN_PRESETS.find((p) => p.id === h.id)?.label}</span>
                  {current === h.id && <Check size={12} />}
                </button>
              ))}
          </div>
          {current === 'female-ivory' && (
            <p className="wardrobe-note">
              The original gown uses its own model. The three wardrobe looks above share one woman.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
