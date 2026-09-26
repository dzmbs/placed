import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem';

async function main() {
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
    throw Error('This smoke test only writes fixtures to a local server.');
  const account = privateKeyToAccount(generatePrivateKey());
  const send = (path: string, body: unknown, token?: string) =>
    fetch(`${origin}/api/marketplace${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const challenge = await (await send('/auth/challenge', { wallet: account.address })).json();
  assert.equal(typeof challenge.message, 'string');
  const signature = await account.signMessage({ message: challenge.message });
  const response = await send('/auth/session', { id: challenge.id, signature });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal((await send('/auth/session', { id: challenge.id, signature })).status, 401);
  assert.equal((await send('/world/request', {})).status, 401);
  const verificationStatus = await fetch(`${origin}/api/marketplace/world/authorization`, {
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(verificationStatus.status, 200);
  assert.deepEqual(await verificationStatus.json(), { verified: false });
  assert.equal((await send('/world/authorization', {}, session.token)).status, 403);
  const worldResponse = await send('/world/request', {}, session.token);
  assert.equal(worldResponse.status, 200);
  const world = await worldResponse.json();
  assert.equal(world.allow_legacy_proofs, true);
  assert.equal(typeof world.rp_context.signature, 'string');
  const rejected = await send(
    '/world/verify',
    { result: { nonce: world.rp_context.nonce, environment: 'wrong', responses: [] } },
    session.token,
  );
  assert.equal(rejected.status, 401);
  const logo = await readFile('public/examples/placed-logo.png');
  const media = await fetch(`${origin}/api/marketplace/media`, {
    method: 'POST',
    headers: { 'content-type': 'image/png', origin, authorization: `Bearer ${session.token}` },
    body: new Uint8Array(logo),
  });
  assert.equal(media.status, 200);
  const record = await media.json();
  assert.equal(record.hash, keccak256(logo));
  const stored = await fetch(record.uri);
  assert.equal(keccak256(new Uint8Array(await stored.arrayBuffer())), record.hash);
  assert.equal(stored.headers.get('x-content-type-options'), 'nosniff');
  const invalid = await send(
    '/metadata',
    { kind: 'slot', metadata: { name: 'Bad', placement: {} } },
    session.token,
  );
  assert.equal(invalid.status, 400);
  const assets = await fetch(`${origin}/api/marketplace/assets`);
  assert.equal(assets.status, 200);
  assert.ok(Array.isArray(await assets.json()));
  const balances = await fetch(`${origin}/api/marketplace/wallet/${account.address}`);
  assert.equal(balances.status, 200);
  assert.equal((await balances.json()).authorized, false);
  console.log(
    'Passed: wallet challenge/replay, authentication, signed World request/rejection, protected authorization, immutable media, metadata validation and Sepolia reads.',
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'API smoke test failed.');
  process.exitCode = 1;
});
