import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialDraft, safeDraft, validateDraft, defaultSpots, ASSETS } from '../src/lib/studio';

test('every template starts with distinct, valid placements', () => {
  for (const asset of ASSETS) {
    const draft = { ...initialDraft(), asset: asset.id, spots: defaultSpots(asset.id) };
    assert.deepEqual(validateDraft(draft), []);
    assert.ok(safeDraft(JSON.parse(JSON.stringify(draft))));
    assert.equal(new Set(draft.spots.map((s) => s.id)).size, draft.spots.length);
  }
});
test('listing rejects impossible dates, invalid bids and an empty canvas', () => {
  const draft = initialDraft();
  draft.campaign.auctionEnd = 'not-a-date';
  draft.campaign.endDate = '2026-09-01';
  draft.spots[0].price = 0;
  assert.equal(validateDraft(draft).length, 3);
  draft.spots = [];
  assert.ok(validateDraft(draft).some((s) => s.includes('placement')));
});
test('import rejects incomplete, malformed and externally linked drafts without throwing', () => {
  for (const change of [
    { campaign: {} },
    { spots: [null] },
    { assetUrl: 'https://example.com/model.glb' },
    { spots: [{ ...initialDraft().spots[0], artwork: 'https://example.com/logo.png' }] },
    { spots: [{ ...initialDraft().spots[0], width: 0 }] },
    { spots: [initialDraft().spots[0], initialDraft().spots[0]] },
    { humanPreset: 'male-casual' },
    { asset: 'dress', humanPreset: '../../some-model' },
  ])
    assert.equal(safeDraft({ ...initialDraft(), ...change }), null);
});
test('custom model and embedded artwork survive an export/import round trip', () => {
  const draft = initialDraft();
  draft.asset = 'custom';
  draft.assetUrl = '/api/assets/12345678-1234-1234-1234-123456789abc';
  draft.spots[0].artwork = 'data:image/png;base64,aGVsbG8=';
  draft.spots[0].meshName = 'imported-surface-0';
  draft.spots[0].projection = true;
  assert.deepEqual(safeDraft(JSON.parse(JSON.stringify(draft))), draft);
});
