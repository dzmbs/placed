import type { IDKitResult } from '@worldcoin/idkit-core';
import { worldSignalHash } from './math';

export interface ExpectedWorldRequest {
  nonce: string;
  signal: string;
  action: string;
  environment: string;
  expires: number;
  allowLegacy?: boolean;
}
export function validateWorldResult(
  result: IDKitResult,
  expected: ExpectedWorldRequest,
  now: number,
) {
  if (now > expected.expires) throw new Error('World request expired. Start verification again.');
  if ('session_id' in result || !['3.0', '4.0'].includes(result.protocol_version))
    throw new Error('World must return a uniqueness proof.');
  if (result.nonce !== expected.nonce || result.action !== expected.action)
    throw new Error(
      'World proof belongs to a different request or action. Start verification again.',
    );
  if (result.environment !== expected.environment)
    throw new Error('World proof environment does not match this app.');
  if (!Array.isArray(result.responses) || result.responses.length !== 1)
    throw new Error('World must return one Proof of Human credential.');
  const credential = result.responses[0];
  if (
    credential.signal_hash === undefined ||
    BigInt(credential.signal_hash) !== BigInt(worldSignalHash(expected.signal))
  )
    throw new Error('World proof is not bound to the connected wallet.');
  if (!/^0x[a-fA-F0-9]{1,64}$/.test(credential.nullifier) || BigInt(credential.nullifier) === 0n)
    throw new Error('World returned a malformed human nullifier.');
  if (result.protocol_version === '3.0') {
    const legacy = result.responses[0];
    if (!expected.allowLegacy || legacy.identifier !== 'orb')
      throw new Error(
        'World returned a different credential. Proof of Human or its Orb fallback is required.',
      );
    if (
      typeof legacy.proof !== 'string' ||
      !/^0x[0-9a-fA-F]{512}$/.test(legacy.proof) ||
      !/^0x[0-9a-fA-F]{1,64}$/.test(legacy.merkle_root)
    )
      throw new Error('World returned a malformed Orb proof.');
  } else if (result.protocol_version === '4.0') {
    const human = result.responses[0];
    if (human.identifier !== 'proof_of_human' || human.issuer_schema_id !== 1)
      throw new Error('World returned a different credential. Proof of Human is required.');
    // expires_at_min is a disclosed lower bound, not the credential's expiry.
    if (
      !Number.isSafeInteger(human.expires_at_min) ||
      human.expires_at_min < 0 ||
      !Array.isArray(human.proof) ||
      human.proof.length !== 5
    )
      throw new Error('World returned a malformed human proof.');
  }
  return BigInt(credential.nullifier).toString(10);
}
