import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  initializeWorldRequests,
  reusableWorldRequest,
  claimWorldAttempt,
  deferWorldAttempt,
  retireWorldRequest,
  type SignedWorldRequest,
} from '../src/lib/marketplace/world-request-store';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE world_requests(nonce TEXT PRIMARY KEY,wallet TEXT,signal TEXT,action TEXT,environment TEXT,expires INTEGER,consumed INTEGER DEFAULT 0)',
  );
  initializeWorldRequests(db);
  return db;
}
const config = {
  app_id: 'app_test' as const,
  rp_id: 'rp_test',
  action: 'human',
  environment: 'staging' as const,
};
const signed = (nonce: string, now = 100): SignedWorldRequest => ({
  app_id: config.app_id,
  action: config.action,
  environment: config.environment,
  signal: `wallet:${nonce}`,
  allow_legacy_proofs: true,
  rp_context: {
    rp_id: config.rp_id,
    nonce,
    created_at: now,
    expires_at: now + 300,
    signature: 'signed',
  },
});
test('closing or retrying 50 times reuses one signed request even after a restart', () => {
  const db = setup();
  let created = 0;
  const create = () => signed(String(++created));
  for (let i = 0; i < 50; i++) {
    if (i === 25) initializeWorldRequests(db);
    assert.equal(
      reusableWorldRequest(db, '0xAlice', config, create, 100 + i).rp_context.nonce,
      '1',
    );
  }
  assert.equal(created, 1);
  assert.equal(
    (
      db.prepare('SELECT COUNT(*) AS n FROM world_requests WHERE consumed = 0').get() as {
        n: number;
      }
    ).n,
    1,
  );
  db.close();
});
test('legacy abandoned requests are retired; expiration and wallet changes cannot reuse a nonce', () => {
  const db = setup();
  for (let i = 0; i < 5; i++)
    db.prepare('INSERT INTO world_requests(nonce,wallet,expires) VALUES(?,?,?)').run(
      `old${i}`,
      'alice',
      400,
    );
  const first = reusableWorldRequest(db, 'alice', config, () => signed('new'), 100);
  assert.equal(first.rp_context.nonce, 'new');
  assert.equal(
    (
      db
        .prepare('SELECT COUNT(*) AS n FROM world_requests WHERE consumed = 0 AND wallet = ?')
        .get('alice') as { n: number }
    ).n,
    1,
  );
  assert.equal(
    reusableWorldRequest(db, 'bob', config, () => signed('bob'), 100).rp_context.nonce,
    'bob',
  );
  assert.equal(
    reusableWorldRequest(db, 'alice', config, () => signed('later', 380), 380).rp_context.nonce,
    'later',
  );
  assert.equal(
    reusableWorldRequest(
      db,
      'alice',
      { ...config, rp_id: 'rp_changed' },
      () => ({
        ...signed('changed', 380),
        rp_context: { ...signed('changed', 380).rp_context, rp_id: 'rp_changed' },
      }),
      380,
    ).rp_context.nonce,
    'changed',
  );
  db.close();
});
test('only actual proof submissions spend the cooldown and upstream retry windows persist', () => {
  const db = setup();
  assert.equal(claimWorldAttempt(db, 'alice', 100), 0);
  assert.equal(claimWorldAttempt(db, 'alice', 101), 110);
  assert.equal(claimWorldAttempt(db, 'bob', 101), 0);
  deferWorldAttempt(db, 'alice', 160);
  reusableWorldRequest(db, 'alice', config, () => signed('request'), 120);
  assert.equal(claimWorldAttempt(db, 'alice', 120), 160);
  assert.equal(claimWorldAttempt(db, 'alice', 160), 0);
  db.close();
});

test('a failed or fresh attempt never hands back a nonce that may have produced a proof', () => {
  const db = setup();
  const first = reusableWorldRequest(db, 'alice', config, () => signed('first'), 100);
  retireWorldRequest(db, first.rp_context.nonce);
  assert.equal(
    reusableWorldRequest(db, 'alice', config, () => signed('second'), 101).rp_context.nonce,
    'second',
  );
  assert.equal(
    reusableWorldRequest(db, 'alice', config, () => signed('third'), 102, true).rp_context.nonce,
    'third',
  );
  assert.equal(
    reusableWorldRequest(db, 'alice', config, () => signed('unused'), 103).rp_context.nonce,
    'third',
  );
});
