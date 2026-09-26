import { createStore, get, promisifyRequest, setMany, type UseStore } from 'idb-keyval';

export const STUDIO_DRAFT_KEY = 'placed-studio-draft-v1';
export const STUDIO_CANVASES_KEY = 'placed-studio-canvases-v1';
export const STUDIO_LISTINGS_KEY = 'placed-studio-listings-v1';

type LegacyStorage = Pick<Storage, 'getItem' | 'removeItem'>;

// Drafts contain uploaded artwork. Keep them out of localStorage's small quota.
// Serialize operations so a late autosave cannot replace a newer draft.
export function createBrowserDraftStore(
  customStore?: UseStore,
  legacyStorage: () => LegacyStorage = () => window.localStorage,
) {
  let store = customStore;
  let pending: Promise<unknown> = Promise.resolve();
  const getStore = () => (store ??= createStore('placed-drafts', 'drafts'));
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  }
  return {
    read(key: string): Promise<unknown> {
      return enqueue(async () => {
        const database = getStore();
        const saved = await get<unknown>(key, database);
        if (saved !== undefined) return saved;
        const legacy = legacyStorage();
        const raw = legacy.getItem(key);
        if (raw === null) return undefined;
        const value: unknown = JSON.parse(raw);
        // Wait for the transaction to commit before removing the old copy.
        const restored = await database('readwrite', async (objectStore) => {
          const committed = promisifyRequest(objectStore.transaction);
          const request = objectStore.get(key);
          let result = value;
          request.onsuccess = () => {
            // Another tab may have saved while the legacy copy was being read.
            if (request.result === undefined) objectStore.put(value, key);
            else result = request.result;
          };
          await committed;
          return result;
        });
        try {
          if (legacy.getItem(key) === raw) legacy.removeItem(key);
        } catch {
          // The durable copy is saved even if legacy storage is unavailable.
        }
        return restored;
      });
    },
    write(entries: [string, unknown][]): Promise<void> {
      // Capture the values now, rather than after an earlier operation completes.
      const snapshot = structuredClone(entries);
      return enqueue(() => setMany(snapshot, getStore()));
    },
  };
}

export const browserDrafts = createBrowserDraftStore();

export function draftStorageMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError')
    return 'Device storage is full. Export your campaign to keep a copy, then free some space and retry.';
  return 'Your draft could not be saved on this device. Export a copy before closing, then retry.';
}
