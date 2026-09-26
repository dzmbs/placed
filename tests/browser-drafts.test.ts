import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { createStore, get, setMany, type UseStore } from 'idb-keyval';
import {
  createBrowserDraftStore,
  draftStorageMessage,
  STUDIO_DRAFT_KEY,
  STUDIO_CANVASES_KEY,
  STUDIO_LISTINGS_KEY,
} from '../src/lib/browser-drafts';
import { PENDING_KEY } from '../src/lib/market';
import { initialDraft, safeDraft } from '../src/lib/studio';

function fixture() {
  const store = createStore(`draft-test-${crypto.randomUUID()}`, 'drafts');
  const values = new Map<string, string>();
  const legacy = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: () => {
      throw new DOMException('Full', 'QuotaExceededError');
    },
  };
  return { store, values, legacy, drafts: createBrowserDraftStore(store, () => legacy) };
}

test('large artwork reaches publish and survives reload even when localStorage is full', async () => {
  const { store, legacy, drafts } = fixture();
  const draft = initialDraft();
  const artwork = `data:image/png;base64,${'A'.repeat(2_700_000)}`;
  draft.spots = Array.from({ length: 3 }, (_, i) => ({
    ...draft.spots[0],
    id: `large-${i}`,
    artwork,
  }));
  assert.ok(JSON.stringify(draft).length > 8_000_000);
  assert.throws(() => legacy.setItem(), { name: 'QuotaExceededError' });
  await drafts.write([
    [STUDIO_DRAFT_KEY, draft],
    [STUDIO_CANVASES_KEY, { suitcase: draft }],
    [STUDIO_LISTINGS_KEY, [draft]],
    [PENDING_KEY, draft],
  ]);
  const reloaded = createBrowserDraftStore(store, () => legacy);
  assert.deepEqual(safeDraft(await reloaded.read(PENDING_KEY)), draft);
  assert.deepEqual(await reloaded.read(STUDIO_DRAFT_KEY), draft);
});

test('legacy drafts migrate without losing artwork or unrelated browser data', async () => {
  const { values, drafts, store } = fixture();
  const draft = initialDraft();
  draft.spots[0].artwork = 'data:image/png;base64,aGVsbG8=';
  values.set(STUDIO_DRAFT_KEY, JSON.stringify(draft));
  values.set('unrelated', 'keep');
  assert.deepEqual(await drafts.read(STUDIO_DRAFT_KEY), draft);
  assert.deepEqual(await get(STUDIO_DRAFT_KEY, store), draft);
  assert.equal(values.has(STUDIO_DRAFT_KEY), false);
  assert.equal(values.get('unrelated'), 'keep');
});

test('failed migration keeps the original draft and allows a later retry', async () => {
  const { values, store, legacy } = fixture();
  const draft = initialDraft();
  const raw = JSON.stringify(draft);
  values.set(STUDIO_DRAFT_KEY, raw);
  let fail = true;
  const aborting: UseStore = (mode, callback) =>
    store(mode, (objectStore) => {
      const result = callback(objectStore);
      if (mode === 'readwrite' && fail) objectStore.transaction.abort();
      return result;
    });
  const drafts = createBrowserDraftStore(aborting, () => legacy);
  await assert.rejects(drafts.read(STUDIO_DRAFT_KEY));
  assert.equal(values.get(STUDIO_DRAFT_KEY), raw);
  assert.equal(await get(STUDIO_DRAFT_KEY, store), undefined);
  fail = false;
  assert.deepEqual(await drafts.read(STUDIO_DRAFT_KEY), draft);
  assert.equal(values.has(STUDIO_DRAFT_KEY), false);
});

test('a failed publish transaction cannot save the gallery without its handoff', async () => {
  const { drafts, store, legacy } = fixture();
  const previous = initialDraft();
  await drafts.write([
    [STUDIO_LISTINGS_KEY, [previous]],
    [PENDING_KEY, previous],
  ]);
  const aborting: UseStore = (mode, callback) =>
    store(mode, (objectStore) => {
      const result = callback(objectStore);
      if (mode === 'readwrite') objectStore.transaction.abort();
      return result;
    });
  const next = { ...previous, assetName: 'New campaign' };
  const failing = createBrowserDraftStore(aborting, () => legacy);
  await assert.rejects(
    failing.write([
      [STUDIO_LISTINGS_KEY, [next, previous]],
      [PENDING_KEY, next],
    ]),
  );
  assert.deepEqual(await drafts.read(STUDIO_LISTINGS_KEY), [previous]);
  assert.deepEqual(await drafts.read(PENDING_KEY), previous);
});

test('queued saves preserve call order and capture data before later edits', async () => {
  const { drafts } = fixture();
  const draft = initialDraft();
  draft.assetName = 'First';
  const first = drafts.write([
    [STUDIO_DRAFT_KEY, draft],
    [PENDING_KEY, draft],
  ]);
  draft.assetName = 'Latest';
  const last = drafts.write([[STUDIO_DRAFT_KEY, draft]]);
  draft.assetName = 'Unsaved edit';
  await Promise.all([first, last]);
  assert.equal(safeDraft(await drafts.read(STUDIO_DRAFT_KEY))?.assetName, 'Latest');
  assert.equal(safeDraft(await drafts.read(PENDING_KEY))?.assetName, 'First');
});

test('an existing IndexedDB draft takes precedence over an old localStorage copy', async () => {
  const { drafts, values } = fixture();
  const draft = { ...initialDraft(), assetName: 'Latest' };
  values.set(STUDIO_DRAFT_KEY, JSON.stringify(initialDraft()));
  await drafts.write([[STUDIO_DRAFT_KEY, draft]]);
  assert.deepEqual(await drafts.read(STUDIO_DRAFT_KEY), draft);
});

test('migration preserves a newer draft saved by another tab during migration', async () => {
  const { store, values, legacy } = fixture();
  const latest = { ...initialDraft(), assetName: 'Saved in another tab' };
  values.set(STUDIO_DRAFT_KEY, JSON.stringify(initialDraft()));
  let savedInOtherTab = false;
  const concurrent: UseStore = async (mode, callback) => {
    if (mode === 'readwrite' && !savedInOtherTab) {
      savedInOtherTab = true;
      await setMany([[STUDIO_DRAFT_KEY, latest]], store);
    }
    return store(mode, callback);
  };
  const drafts = createBrowserDraftStore(concurrent, () => legacy);
  assert.deepEqual(await drafts.read(STUDIO_DRAFT_KEY), latest);
  assert.deepEqual(await get(STUDIO_DRAFT_KEY, store), latest);
});

test('invalid legacy data is retained and storage errors are not all labelled quota errors', async () => {
  const { drafts, values } = fixture();
  values.set(STUDIO_DRAFT_KEY, '{invalid');
  await assert.rejects(drafts.read(STUDIO_DRAFT_KEY));
  assert.equal(values.get(STUDIO_DRAFT_KEY), '{invalid');
  assert.match(
    draftStorageMessage(new DOMException('Full', 'QuotaExceededError')),
    /storage is full/,
  );
  assert.doesNotMatch(draftStorageMessage(new Error('Blocked')), /storage is full/);
});
