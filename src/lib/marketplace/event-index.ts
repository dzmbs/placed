import type { DatabaseSync } from 'node:sqlite';
import { readEventRange } from './event-range';

export const encodeIndexValue = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? { $bigint: String(item) } : item));
export const decodeIndexValue = <T>(value: string): T =>
  JSON.parse(value, (_, item) =>
    item && typeof item === 'object' && '$bigint' in item ? BigInt(item.$bigint) : item,
  ) as T;

export interface IndexedLog {
  blockNumber: bigint;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
}
export function initializeEventIndex(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chain_cursors (
      stream TEXT PRIMARY KEY, block INTEGER NOT NULL, hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chain_events (
      stream TEXT NOT NULL, block INTEGER NOT NULL, position INTEGER NOT NULL,
      payload TEXT NOT NULL, PRIMARY KEY(stream,block,position)
    );
  `);
}
export class EventIndex {
  private pending = new Map<string, Promise<void>>();
  constructor(private db: DatabaseSync) {
    initializeEventIndex(db);
  }
  async read<T extends IndexedLog>(
    stream: string,
    start: bigint,
    to: bigint,
    load: (from: bigint, to: bigint) => Promise<T[]>,
    blockHash: (block: bigint) => Promise<string>,
  ): Promise<T[]> {
    // A stream is shared by all wallets. Every caller checks the cursor again
    // after an in-flight sync, including callers requesting a newer head.
    while (this.pending.has(stream)) await this.pending.get(stream);
    const sync = this.sync(stream, start, to, load, blockHash);
    this.pending.set(stream, sync);
    try {
      await sync;
    } finally {
      if (this.pending.get(stream) === sync) this.pending.delete(stream);
    }
    return (
      this.db
        .prepare(
          'SELECT payload FROM chain_events WHERE stream = ? AND block >= ? AND block <= ? ORDER BY block,position',
        )
        .all(stream, Number(start), Number(to)) as { payload: string }[]
    ).map((row) => decodeIndexValue<T>(row.payload));
  }
  private async sync<T extends IndexedLog>(
    stream: string,
    start: bigint,
    to: bigint,
    load: (from: bigint, to: bigint) => Promise<T[]>,
    blockHash: (block: bigint) => Promise<string>,
  ) {
    if (to < start) return;
    const cursor = this.db
      .prepare('SELECT block,hash FROM chain_cursors WHERE stream = ?')
      .get(stream) as { block: number; hash: string } | undefined;
    // A slower caller can request an older, already indexed block. That is not
    // evidence of a reorg and must not rewind a cursor advanced by another read.
    if (cursor && BigInt(cursor.block) > to) return;
    let from = cursor ? BigInt(cursor.block) + 1n : start;
    let reset = false;
    if (cursor) {
      // A changed checkpoint means cached logs belong to a discarded fork.
      // Rebuild conservatively rather than returning phantom bids or balances.
      reset = (await blockHash(BigInt(cursor.block))) !== cursor.hash;
      if (reset) from = start;
    }
    if (from > to) return;
    const logs = await readEventRange(from, to, load);
    const hash = await blockHash(to);
    for (const log of logs) {
      if (log.blockNumber < from || log.blockNumber > to)
        throw new Error('The RPC returned logs outside the requested range.');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.db
        .prepare('SELECT block FROM chain_cursors WHERE stream = ?')
        .get(stream) as { block: number } | undefined;
      if (current && BigInt(current.block) > to) {
        this.db.exec('COMMIT');
        return;
      }
      if (reset) this.db.prepare('DELETE FROM chain_events WHERE stream = ?').run(stream);
      const insert = this.db.prepare('INSERT OR REPLACE INTO chain_events VALUES(?,?,?,?)');
      for (const log of logs)
        insert.run(stream, Number(log.blockNumber), log.logIndex, encodeIndexValue(log));
      this.db
        .prepare('INSERT OR REPLACE INTO chain_cursors VALUES(?,?,?)')
        .run(stream, Number(to), hash);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
