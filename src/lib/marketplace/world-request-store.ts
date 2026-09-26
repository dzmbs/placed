import type { DatabaseSync } from 'node:sqlite';

export interface SignedWorldRequest {
  app_id: `app_${string}`;
  action: string;
  environment: 'production' | 'staging';
  signal: string;
  allow_legacy_proofs: true;
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
}
export function initializeWorldRequests(db: DatabaseSync) {
  const columns = db.prepare('PRAGMA table_info(world_requests)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'payload'))
    db.exec('ALTER TABLE world_requests ADD COLUMN payload TEXT');
  db.exec(
    `CREATE TABLE IF NOT EXISTS world_attempts (wallet TEXT PRIMARY KEY, retry_at INTEGER NOT NULL)`,
  );
}
export function reusableWorldRequest(
  db: DatabaseSync,
  wallet: string,
  config: Pick<SignedWorldRequest, 'app_id' | 'action' | 'environment'> & { rp_id: string },
  create: () => SignedWorldRequest,
  now: number,
  fresh = false,
) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM world_requests WHERE expires < ?').run(now);
    db.prepare('DELETE FROM world_attempts WHERE retry_at <= ?').run(now);
    // World rejects a nonce that already produced a proof (duplicate_nonce), so
    // a failed attempt must never hand the same signed request back.
    if (fresh)
      db.prepare('UPDATE world_requests SET consumed = 1 WHERE wallet = ? AND consumed = 0').run(
        wallet.toLowerCase(),
      );
    const rows = db
      .prepare(
        'SELECT payload FROM world_requests WHERE wallet = ? AND consumed = 0 AND expires > ? AND payload IS NOT NULL ORDER BY expires DESC',
      )
      .all(wallet.toLowerCase(), now + 30) as { payload: string }[];
    const existing = rows
      .map((row) => JSON.parse(row.payload) as SignedWorldRequest)
      .find(
        (item) =>
          item.app_id === config.app_id &&
          item.action === config.action &&
          item.environment === config.environment &&
          item.rp_context.rp_id === config.rp_id,
      );
    const request = existing ?? create();
    // Retire old requests (including requests created before this migration).
    // A wallet has one live nonce, however often the user closes and retries.
    db.prepare(
      'UPDATE world_requests SET consumed = 1 WHERE wallet = ? AND nonce <> ? AND consumed = 0',
    ).run(wallet.toLowerCase(), request.rp_context.nonce);
    if (!existing)
      db.prepare(
        'INSERT INTO world_requests(nonce,wallet,signal,action,environment,expires,payload) VALUES(?,?,?,?,?,?,?)',
      ).run(
        request.rp_context.nonce,
        wallet.toLowerCase(),
        request.signal,
        request.action,
        request.environment,
        request.rp_context.expires_at,
        JSON.stringify(request),
      );
    db.exec('COMMIT');
    return request;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function retireWorldRequest(db: DatabaseSync, nonce: string) {
  db.prepare('UPDATE world_requests SET consumed = 1 WHERE nonce = ?').run(nonce);
}
export function worldRetryAt(db: DatabaseSync, wallet: string) {
  return (
    (
      db
        .prepare('SELECT retry_at FROM world_attempts WHERE wallet = ?')
        .get(wallet.toLowerCase()) as { retry_at: number } | undefined
    )?.retry_at ?? 0
  );
}
export function deferWorldAttempt(db: DatabaseSync, wallet: string, retryAt: number) {
  db.prepare(
    'INSERT INTO world_attempts VALUES(?,?) ON CONFLICT(wallet) DO UPDATE SET retry_at = MAX(retry_at,excluded.retry_at)',
  ).run(wallet.toLowerCase(), retryAt);
}
export function claimWorldAttempt(db: DatabaseSync, wallet: string, now: number) {
  const claimed = db
    .prepare(
      'INSERT INTO world_attempts VALUES(?,?) ON CONFLICT(wallet) DO UPDATE SET retry_at = excluded.retry_at WHERE retry_at <= ?',
    )
    .run(wallet.toLowerCase(), now + 10, now);
  return claimed.changes === 1 ? 0 : worldRetryAt(db, wallet);
}
