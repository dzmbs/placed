import 'server-only';
import { createHmac } from 'node:crypto';
import { signRequest } from '@worldcoin/idkit-core/signing';
import type { IDKitResult } from '@worldcoin/idkit-core';
import type { Address } from 'viem';
import { database } from './database';
import { RequestError } from './http';
import { publicClient, requireDeployment, signingAccount } from './chain';
import { contracts, auctionDomain } from '../config';
import { auctionHouseAbi } from '../abi/AuctionHouse';
import { participantTypes } from '../math';
import { validateWorldResult } from '../world-policy';
import { requireWorldStagingToken, verifyWorldProof, WorldVerifierError } from '../world-verifier';

export function worldConfiguration() {
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const rpId = process.env.WORLD_RP_ID;
  const signingKey = process.env.WORLD_SIGNING_KEY;
  const action = process.env.WORLD_ACTION || 'placed-participant';
  const environment = process.env.WORLD_ENVIRONMENT || 'staging';
  if (
    !appId?.startsWith('app_') ||
    !rpId?.startsWith('rp_') ||
    !signingKey ||
    !['production', 'staging'].includes(environment)
  )
    throw new RequestError('World ID is not configured.', 503);
  return {
    appId: appId as `app_${string}`,
    rpId,
    signingKey,
    action,
    environment: environment as 'production' | 'staging',
  };
}
export function createWorldRequest(wallet: Address) {
  const config = worldConfiguration();
  try {
    requireWorldStagingToken(config.environment, process.env.WORLD_STAGING_VERIFICATION_TOKEN);
  } catch (error) {
    if (error instanceof WorldVerifierError) throw new RequestError(error.message, error.status);
    throw error;
  }
  const signature = signRequest({
    signingKeyHex: config.signingKey,
    action: config.action,
    ttl: 300,
  });
  const signal = `placed:${wallet.toLowerCase()}:11155111:${signature.nonce}`;
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM world_requests WHERE expires < ?').run(now);
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM world_requests WHERE wallet = ? AND consumed = 0')
    .get(wallet.toLowerCase()) as { count: number };
  if (row.count >= 5)
    throw new RequestError('Too many pending World requests. Try again in five minutes.', 429);
  db.prepare(
    'INSERT INTO world_requests(nonce,wallet,signal,action,environment,expires) VALUES(?,?,?,?,?,?)',
  ).run(
    signature.nonce,
    wallet.toLowerCase(),
    signal,
    config.action,
    config.environment,
    signature.expiresAt,
  );
  return {
    app_id: config.appId,
    action: config.action,
    environment: config.environment,
    signal,
    allow_legacy_proofs: true as const,
    rp_context: {
      rp_id: config.rpId,
      nonce: signature.nonce,
      created_at: signature.createdAt,
      expires_at: signature.expiresAt,
      signature: signature.sig,
    },
  };
}
export async function verifyWorldRequest(wallet: Address, result: IDKitResult) {
  const config = worldConfiguration();
  if (!result || typeof result.nonce !== 'string' || !Array.isArray(result.responses))
    throw new RequestError('Invalid World verification response.');
  const db = database();
  const expected = db
    .prepare('SELECT * FROM world_requests WHERE nonce = ? AND wallet = ?')
    .get(result.nonce, wallet.toLowerCase()) as
    | {
        nonce: string;
        signal: string;
        action: string;
        environment: string;
        expires: number;
        consumed: number;
      }
    | undefined;
  if (!expected || expected.consumed)
    throw new RequestError('World request was not found or was already used.', 401);
  let nullifier: string;
  try {
    nullifier = validateWorldResult(
      result,
      { ...expected, allowLegacy: true },
      Math.floor(Date.now() / 1000),
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('World')
        ? error.message
        : 'World returned a malformed proof.';
    console.warn('[World verification]', message);
    throw new RequestError(message, 401);
  }
  try {
    await verifyWorldProof(
      result,
      config.rpId,
      expected.environment,
      process.env.WORLD_STAGING_VERIFICATION_TOKEN,
    );
  } catch (error) {
    if (error instanceof WorldVerifierError) {
      console.warn('[World verifier]', error.code);
      throw new RequestError(error.message, error.status);
    }
    throw error;
  }
  const salt = process.env.WORLD_IDENTITY_SALT;
  if (!salt || salt.length < 32)
    throw new RequestError('World identity storage is not configured.', 503);
  const identity = createHmac('sha256', salt)
    .update(`${config.rpId}:${expected.action}:${nullifier}`)
    .digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    const person = db
      .prepare('SELECT wallet FROM participants WHERE identity = ?')
      .get(identity) as { wallet: string } | undefined;
    const linked = db
      .prepare('SELECT identity FROM participants WHERE wallet = ?')
      .get(wallet.toLowerCase()) as { identity: string } | undefined;
    if (
      (person && person.wallet !== wallet.toLowerCase()) ||
      (linked && linked.identity !== identity)
    )
      throw new RequestError(
        'This person or wallet is already linked to another participant.',
        409,
      );
    const consumed = db
      .prepare(
        'UPDATE world_requests SET consumed = 1 WHERE nonce = ? AND consumed = 0 AND expires >= ?',
      )
      .run(expected.nonce, Math.floor(Date.now() / 1000));
    if (consumed.changes !== 1)
      throw new RequestError('World request expired or was already used.', 401);
    db.prepare('INSERT OR IGNORE INTO participants(identity,wallet,verified) VALUES(?,?,?)').run(
      identity,
      wallet.toLowerCase(),
      Math.floor(Date.now() / 1000),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return participantAuthorization(wallet);
}
export function hasWorldVerification(wallet: Address) {
  return Boolean(
    database().prepare('SELECT 1 FROM participants WHERE wallet = ?').get(wallet.toLowerCase()),
  );
}
export async function participantAuthorization(wallet: Address) {
  requireDeployment();
  if (!hasWorldVerification(wallet))
    throw new RequestError('Complete Proof of Human verification first.', 403);
  const signer = signingAccount('PRIVATE_KEY');
  const [expectedSigner, nonce] = await Promise.all([
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'participantSigner',
    }),
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'participantNonces',
      args: [wallet],
    }),
  ]);
  if (signer.address.toLowerCase() !== expectedSigner.toLowerCase())
    throw new RequestError('World authorization signer does not match the deployed contract.', 503);
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const signature = await signer.signTypedData({
    domain: auctionDomain(),
    types: participantTypes,
    primaryType: 'ParticipantAuthorization',
    message: { wallet, nonce, deadline: BigInt(deadline) },
  });
  return { wallet, deadline, signature };
}
