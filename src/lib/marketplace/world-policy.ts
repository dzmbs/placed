import type { IDKitResult } from '@worldcoin/idkit-core';
import { worldSignalHash } from './math';

export interface ExpectedWorldRequest {
  nonce: string;
  signal: string;
  action: string;
  environment: string;
  expires: number;
}
export function validateWorldResult(
  result: IDKitResult,
  expected: ExpectedWorldRequest,
  now: number,
) {
  if (
    now > expected.expires ||
    result.protocol_version !== '4.0' ||
    'session_id' in result ||
    result.nonce !== expected.nonce ||
    result.action !== expected.action ||
    result.environment !== expected.environment ||
    result.responses.length !== 1
  )
    throw new Error('World verification does not match this wallet request.');
  const credential = result.responses[0];
  if (
    credential.identifier !== 'proof_of_human' ||
    credential.issuer_schema_id !== 1 ||
    credential.expires_at_min < now ||
    credential.signal_hash === undefined ||
    BigInt(credential.signal_hash) !== BigInt(worldSignalHash(expected.signal)) ||
    !/^0x[a-fA-F0-9]{1,64}$/.test(credential.nullifier) ||
    BigInt(credential.nullifier) === 0n ||
    !Array.isArray(credential.proof) ||
    credential.proof.length !== 5
  )
    throw new Error('A wallet-bound Proof of Human credential is required.');
  return BigInt(credential.nullifier).toString(10);
}
