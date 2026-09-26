import 'server-only';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { getAddress, isAddress, isHex, type Address } from 'viem';
import { database } from './database';
import { RequestError } from './http';
import { publicClient } from './chain';

export function digestToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function walletAddress(value: unknown): Address {
  if (typeof value !== 'string' || !isAddress(value))
    throw new RequestError('A valid wallet address is required.');
  return getAddress(value);
}
export function createChallenge(wallet: Address) {
  const now = Math.floor(Date.now() / 1000);
  const db = database();
  db.prepare('DELETE FROM challenges WHERE expires < ?').run(now);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
  const pending = db
    .prepare('SELECT COUNT(*) AS count FROM challenges WHERE wallet = ? AND consumed = 0')
    .get(wallet.toLowerCase()) as { count: number };
  if (pending.count >= 5)
    throw new RequestError('Too many pending wallet challenges. Try again in five minutes.', 429);
  const id = randomUUID(),
    expires = now + 300;
  const origin = (process.env.APP_ORIGIN || 'http://127.0.0.1:3000').split(',')[0].trim();
  const message = `${new URL(origin).host} requests a wallet session for Placed.\n\nWallet: ${wallet}\nChain: Ethereum Sepolia (11155111)\nNonce: ${id}\nExpires: ${new Date(expires * 1000).toISOString()}\n\nThis signature starts a local application session. It does not move funds.`;
  db.prepare('INSERT INTO challenges(id,wallet,message,expires) VALUES(?,?,?,?)').run(
    id,
    wallet.toLowerCase(),
    message,
    expires,
  );
  return { id, message, expires };
}
export async function verifyChallenge(id: unknown, signature: unknown) {
  if (typeof id !== 'string' || typeof signature !== 'string' || !isHex(signature))
    throw new RequestError('Invalid wallet challenge.');
  const db = database();
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as
    { wallet: string; message: string; expires: number; consumed: number } | undefined;
  const now = Math.floor(Date.now() / 1000);
  if (!challenge || challenge.consumed || challenge.expires < now)
    throw new RequestError('Wallet challenge has expired or was already used.', 401);
  const valid = await publicClient.verifyMessage({
    address: walletAddress(challenge.wallet),
    message: challenge.message,
    signature,
  });
  if (!valid) throw new RequestError('Wallet signature was rejected.', 401);
  const changed = db
    .prepare('UPDATE challenges SET consumed = 1 WHERE id = ? AND consumed = 0 AND expires >= ?')
    .run(id, Math.floor(Date.now() / 1000));
  if (changed.changes !== 1) throw new RequestError('Wallet challenge was already used.', 401);
  const token = randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  db.prepare('INSERT INTO sessions(digest,wallet,expires) VALUES(?,?,?)').run(
    digestToken(token),
    challenge.wallet,
    expires,
  );
  return { token, wallet: walletAddress(challenge.wallet), expires };
}
export function requireSession(request: Request): Address {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new RequestError('Connect and sign in with your wallet.', 401);
  const row = database()
    .prepare('SELECT wallet FROM sessions WHERE digest = ? AND expires >= ?')
    .get(digestToken(token), Math.floor(Date.now() / 1000)) as { wallet: string } | undefined;
  if (!row) throw new RequestError('Wallet session has expired.', 401);
  return walletAddress(row.wallet);
}
