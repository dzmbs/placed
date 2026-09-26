import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialDraft } from '../src/lib/studio';
import {
  canvasKey,
  rememberCanvas,
  safeCanvasDrafts,
  selectCanvas,
  selectHuman,
} from '../src/lib/canvas-drafts';
import { FEMALE_LOOKS, MALE_TOPS, MALE_BOTTOMS, malePresetFor, maleLook } from '../src/lib/humans';

const modelA = '/api/assets/12345678-1234-1234-1234-123456789abc';
const modelB = '/api/assets/87654321-1234-1234-1234-123456789abc';

test('a generated canvas retains placements and campaign edits after switching to a template', () => {
  const draft = initialDraft();
  draft.asset = 'custom';
  draft.assetUrl = modelA;
  draft.assetName = 'My bag';
  draft.spots[0].price = 900;
  draft.campaign.title = 'My edited campaign';
  let saved = rememberCanvas({}, draft);
  const bike = selectCanvas(saved, draft, 'bicycle');
  saved = rememberCanvas(saved, bike);
  const reopened = selectCanvas(saved, bike, 'custom', modelA, 'My bag');
  assert.deepEqual(reopened, draft);
});
test('separate custom models never share placements and archived drafts survive JSON reload', () => {
  const current = {
    ...initialDraft(),
    asset: 'custom' as const,
    assetUrl: modelA,
    assetName: 'First bag',
  };
  let saved = rememberCanvas({}, current);
  const next = selectCanvas(saved, current, 'custom', modelB, 'Second bag');
  assert.equal(next.spots.length, 0);
  assert.equal(next.assetName, 'Second bag');
  saved = rememberCanvas(saved, next);
  const restored = safeCanvasDrafts(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored[canvasKey(current)], current);
  assert.deepEqual(restored[canvasKey(next)], next);
});
test('template edits return when selecting the template again', () => {
  const current = initialDraft();
  current.color = '#36463e';
  current.spots[0].name = 'Top sponsor';
  const saved = rememberCanvas({}, current);
  const other = selectCanvas(saved, current, 'dress');
  assert.deepEqual(selectCanvas(saved, other, 'suitcase'), current);
});

test('new ad canvases retain their own artwork, sizes and bids across switching and reload', () => {
  let saved = {};
  const templates = ['x-banner', 'twitch', 'billboard'] as const;
  for (const asset of templates) {
    const draft = selectCanvas(saved, initialDraft(), asset);
    draft.spots[0].artwork = 'data:image/png;base64,aGVsbG8=';
    draft.spots[0].price = 987;
    draft.spots[0].width = 3.2;
    draft.campaign.title = `${asset} campaign`;
    saved = rememberCanvas(saved, draft);
  }
  const reloaded = safeCanvasDrafts(JSON.parse(JSON.stringify(saved)));
  for (const asset of templates) {
    const draft = selectCanvas(reloaded, initialDraft(), asset);
    assert.equal(draft.spots[0].artwork, 'data:image/png;base64,aGVsbG8=');
    assert.equal(draft.spots[0].price, 987);
    assert.equal(draft.spots[0].width, 3.2);
    assert.equal(draft.campaign.title, `${asset} campaign`);
  }
});
test('corrupt archived entries are ignored without hiding valid canvases', () => {
  const draft = initialDraft();
  assert.deepEqual(safeCanvasDrafts({ valid: draft, broken: { asset: 'custom' } }), {
    suitcase: draft,
  });
  assert.deepEqual(safeCanvasDrafts(null), {});
});
test('human outfits keep separate placements across switching and campaign reloads', () => {
  const current = initialDraft();
  const male = selectHuman({}, current, 'male-casual', 'Everyday / male', current.spots);
  male.spots[0].price = 777;
  const saved = rememberCanvas({}, male);
  const gown = selectHuman(saved, male, 'female-ivory', 'The ivory gown', []);
  assert.equal(gown.spots.length, 0);
  assert.deepEqual(selectHuman(saved, gown, 'male-casual', 'Everyday / male', []), male);
  assert.deepEqual(safeCanvasDrafts(JSON.parse(JSON.stringify(saved)))[canvasKey(male)], male);
  const suitcase = selectCanvas({}, male, 'suitcase');
  assert.equal(suitcase.humanPreset, undefined);
  assert.equal(canvasKey(suitcase), 'suitcase');
});
test('swapping clothes on the same male keeps outfit-specific logos and positions', () => {
  const casual = selectHuman(
    {},
    initialDraft(),
    'male-casual',
    'Everyday / male',
    initialDraft().spots,
  );
  casual.spots[0].artwork = 'data:image/png;base64,aGVsbG8=';
  casual.spots[0].meshName = 'shirt';
  const running = selectHuman(
    rememberCanvas({}, casual),
    casual,
    'male-athletic',
    'The running kit',
    [],
  );
  assert.equal(running.spots.length, 0);
  running.campaign.title = 'Race day';
  const archive = safeCanvasDrafts(
    JSON.parse(JSON.stringify(rememberCanvas(rememberCanvas({}, casual), running))),
  );
  assert.deepEqual(selectHuman(archive, running, 'male-casual', 'Everyday / male', []), casual);
  assert.deepEqual(selectHuman(archive, casual, 'male-athletic', 'The running kit', []), running);
});
test('each mixed top/bottom combination restores its own edited canvas after reload', () => {
  let archive = {};
  for (const top of MALE_TOPS)
    for (const bottom of MALE_BOTTOMS) {
      const id = malePresetFor(top.id, bottom.id);
      assert.deepEqual(maleLook(id), { top: top.id, bottom: bottom.id });
      const draft = selectHuman(archive, initialDraft(), id, id, initialDraft().spots);
      draft.spots[0].name = `${top.id} / ${bottom.id}`;
      draft.spots[0].price = bottom.id === 'jeans' ? 321 : 654;
      archive = rememberCanvas(archive, draft);
    }
  const restored = safeCanvasDrafts(JSON.parse(JSON.stringify(archive)));
  assert.equal(Object.keys(restored).length, MALE_TOPS.length * MALE_BOTTOMS.length);
  for (const top of MALE_TOPS)
    for (const bottom of MALE_BOTTOMS) {
      const id = malePresetFor(top.id, bottom.id);
      const reopened = selectHuman(restored, initialDraft(), id, id, []);
      assert.equal(reopened.spots[0].name, `${top.id} / ${bottom.id}`);
      assert.equal(reopened.spots[0].price, bottom.id === 'jeans' ? 321 : 654);
    }
});

test('female clothing swaps and the original gown keep distinct saved logos and campaigns', () => {
  let archive = {};
  const presets = [...FEMALE_LOOKS.map((look) => look.id), 'female-ivory'] as const;
  for (const id of presets) {
    const draft = selectHuman(archive, initialDraft(), id, id, initialDraft().spots);
    draft.spots[0].artwork = 'data:image/png;base64,aGVsbG8=';
    draft.spots[0].name = id;
    draft.campaign.event = `${id} event`;
    archive = rememberCanvas(archive, draft);
  }
  const restored = safeCanvasDrafts(JSON.parse(JSON.stringify(archive)));
  for (const id of presets) {
    const reopened = selectHuman(restored, initialDraft(), id, id, []);
    assert.equal(reopened.spots[0].name, id);
    assert.equal(reopened.spots[0].artwork, 'data:image/png;base64,aGVsbG8=');
    assert.equal(reopened.campaign.event, `${id} event`);
  }
});
