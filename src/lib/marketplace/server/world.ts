import 'server-only';
import { createHmac, createHash } from 'node:crypto';
import { signRequest } from '@worldcoin/idkit-core/signing';
import type { IDKitResult } from '@worldcoin/idkit-core';
import type { Address } from 'viem';
import { database } from './database';
import {
  reusableWorldRequest,
  claimWorldAttempt,
  deferWorldAttempt,
  retireWorldRequest,
} from '../world-request-store';
import { ReadCache } from '../read-cache';
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
// Diagnostics only: nonce prefixes and wallets, never proofs, signatures or keys.
export function worldDebug(event: string, details: Record<string, unknown> = {}) {
  console.info(`[world] ${event}`, details);
}
const short = (value: string) => value.slice(0, 10);
export function createWorldRequest(wallet: Address, fresh = false) {
  const config = worldConfiguration();
  try {
    requireWorldStagingToken(config.environment, process.env.WORLD_STAGING_VERIFICATION_TOKEN);
  } catch (error) {
    if (error instanceof WorldVerifierError) throw new RequestError(error.message, error.status);
    throw error;
  }
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  const request = reusableWorldRequest(
    db,
    wallet,
    {
      app_id: config.appId,
      rp_id: config.rpId,
      action: config.action,
      environment: config.environment,
    },
    () => {
      const signature = signRequest({
        signingKeyHex: config.signingKey,
        action: config.action,
        ttl: 300,
      });
      const signal = `placed:${wallet.toLowerCase()}:11155111:${signature.nonce}`;
      return {
        app_id: config.appId,
        action: config.action,
        environment: config.environment,
        signal,
        allow_legacy_proofs: true,
        rp_context: {
          rp_id: config.rpId,
          nonce: signature.nonce,
          created_at: signature.createdAt,
          expires_at: signature.expiresAt,
          signature: signature.sig,
        },
      };
    },
    now,
    fresh,
  );
  worldDebug('request issued', {
    wallet,
    fresh,
    nonce: short(request.rp_context.nonce),
    expiresIn: request.rp_context.expires_at - now,
    action: config.action,
    environment: config.environment,
  });
  return request;
}
const verificationReads = new ReadCache(128);
export function verifyWorldRequest(wallet: Address, result: IDKitResult) {
  const digest = createHash('sha256')
    .update(JSON.stringify(result) ?? '')
    .digest('hex');
  return verificationReads.read(
    `${wallet.toLowerCase()}:${digest}`,
    () => verifyRequest(wallet, result),
    0,
    5000,
  );
}
async function verifyRequest(wallet: Address, result: IDKitResult) {
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
  worldDebug('proof received', {
    wallet,
    nonce: short(result.nonce),
    protocol: result.protocol_version,
    environment: result.environment,
    credential: (result.responses[0] as { identifier?: string } | undefined)?.identifier,
    known: Boolean(expected),
    consumed: Boolean(expected?.consumed),
  });
  if (!expected || expected.consumed)
    throw new RequestError(
      'World request was not found or was already used. Start verification again.',
      401,
    );
  try {
    const authorization = await verifyExpectedRequest(wallet, result, expected, config);
    worldDebug('verified', { wallet, nonce: short(expected.nonce) });
    return authorization;
  } catch (error) {
    // A proof now exists for this nonce, so it can never be used again.
    retireWorldRequest(db, expected.nonce);
    worldDebug('rejected', {
      wallet,
      nonce: short(expected.nonce),
      status: error instanceof RequestError ? error.status : 'unexpected',
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
async function verifyExpectedRequest(
  wallet: Address,
  result: IDKitResult,
  expected: {
    nonce: string;
    signal: string;
    action: string;
    environment: string;
    expires: number;
    consumed: number;
  },
  config: ReturnType<typeof worldConfiguration>,
) {
  const db = database();
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
    throw new RequestError(message, 401);
  }
  const salt = process.env.WORLD_IDENTITY_SALT;
  if (!salt || salt.length < 32)
    throw new RequestError('World identity storage is not configured.', 503);
  // The staging simulator returns the same World ID 4.0 nullifier for every
  // simulator identity, so one-human-one-wallet would let only the first tester
  // through. Staging scopes the identity to the wallet; production stays strict.
  const scope = config.environment === 'staging' ? `:${wallet.toLowerCase()}` : '';
  const identity = createHmac('sha256', salt)
    .update(`${config.rpId}:${expected.action}:${nullifier}${scope}`)
    .digest('hex');
  const linked = db.prepare('SELECT wallet FROM participants WHERE identity = ?').get(identity) as
    | { wallet: string }
    | undefined;
  worldDebug('identity', {
    wallet,
    environment: config.environment,
    walletScoped: Boolean(scope),
    nullifier: `${BigInt(nullifier).toString(16).slice(0, 10)}…`,
    identity: identity.slice(0, 12),
    linkedWallet: linked?.wallet ?? null,
  });
  assertIdentityAvailable(db, identity, wallet, config.environment);
  const now = Math.floor(Date.now() / 1000);
  const retryAt = claimWorldAttempt(db, wallet, now);
  if (retryAt > now)
    throw new RequestError(
      `World verification is cooling down. Try again in ${retryAt - now} seconds.`,
      429,
    );
  // Opening/closing the widget consumes no quota. Limit actual upstream proof
  // attempts, including simultaneous submissions with different proof payloads.
  try {
    await verifyWorldProof(
      result,
      config.rpId,
      expected.environment,
      process.env.WORLD_STAGING_VERIFICATION_TOKEN,
    );
  } catch (error) {
    if (error instanceof WorldVerifierError) {
      worldDebug('upstream verifier refused', { wallet, code: error.code, status: error.status });
      if (error.status === 429) deferWorldAttempt(db, wallet, now + error.retryAfter);
      throw new RequestError(error.message, error.status);
    }
    throw error;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    assertIdentityAvailable(db, identity, wallet, config.environment);
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

function assertIdentityAvailable(
  db: ReturnType<typeof database>,
  identity: string,
  wallet: Address,
  environment: string,
) {
  const person = db.prepare('SELECT wallet FROM participants WHERE identity = ?').get(identity) as
    { wallet: string } | undefined;
  const linked = db
    .prepare('SELECT identity FROM participants WHERE wallet = ?')
    .get(wallet.toLowerCase()) as { identity: string } | undefined;
  if (person && person.wallet !== wallet.toLowerCase())
    throw new RequestError(
      'This World ID is already linked to another wallet. Switch back to your verified wallet.' +
        (environment === 'staging'
          ? ' To test a separate sponsor, select a different identity in the World simulator.'
          : ''),
      409,
    );
  if (linked && linked.identity !== identity)
    throw new RequestError(
      'This wallet is already verified with a different World ID. Use its original World identity or connect another wallet.',
      409,
    );
}
