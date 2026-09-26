// Coalesce concurrent reads and briefly back off failures. Rejected reads never
// become successful cache entries; callers keep seeing the original failure.
export class ReadCache {
  private entries = new Map<string, { promise: Promise<unknown>; expires: number }>();
  constructor(
    private limit = 256,
    private now = Date.now,
  ) {}
  invalidate(key: string) {
    if (this.entries.get(key)?.expires !== Infinity) this.entries.delete(key);
  }
  read<T>(key: string, load: () => Promise<T>, ttl = 3000, failureTtl = 3000): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expires > this.now()) return existing.promise as Promise<T>;
    this.entries.delete(key);
    const entry = { promise: undefined as unknown as Promise<T>, expires: Infinity };
    entry.promise = Promise.resolve()
      .then(load)
      .then(
        (value) => {
          entry.expires = this.now() + ttl;
          return value;
        },
        (error) => {
          entry.expires = this.now() + failureTtl;
          throw error;
        },
      );
    this.entries.set(key, entry);
    // Never evict in-flight work: doing so would allow duplicate RPC requests.
    for (const [id, item] of this.entries) {
      if (this.entries.size <= this.limit) break;
      if (item.expires !== Infinity) this.entries.delete(id);
    }
    return entry.promise;
  }
}
