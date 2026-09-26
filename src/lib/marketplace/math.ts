import { parseUnits, keccak256, toHex } from 'viem';

export const CHAIN_ID = 11155111;
export const USDC_DECIMALS = 6;
export const FIRST_BID = 1_000_000n;
export function usdcAmount(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value))
    throw new Error('Enter a USDC amount with at most six decimal places.');
  return parseUnits(value, USDC_DECIMALS);
}
export function minimumAdvertisingBid(current: bigint, increaseBps: number): bigint {
  if (current < 0n || !Number.isInteger(increaseBps) || increaseBps < 0 || increaseBps > 10000)
    throw new Error('Invalid bid terms.');
  if (current === 0n) return FIRST_BID;
  const increase = (current * BigInt(increaseBps) + 9999n) / 10000n;
  return current + (increase > 0n ? increase : 1n);
}
export function splitAdvertisingPayment(amount: bigint, escrowBps: number, revenueBps: number) {
  for (const bps of [escrowBps, revenueBps])
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error('Invalid payment terms.');
  if (amount < 0n) throw new Error('Invalid payment amount.');
  const released = (amount * BigInt(10000 - escrowBps)) / 10000n;
  const vault = (released * BigInt(revenueBps)) / 10000n;
  return { creator: released - vault, vault, held: amount - released };
}
export function worldSignalHash(signal: string) {
  return toHex(BigInt(keccak256(toHex(signal))) >> 8n, { size: 32 });
}
export function priceQ96(usdcPerToken: string): bigint {
  return (usdcAmount(usdcPerToken) * (1n << 96n)) / 10n ** 18n;
}
export const participantTypes = {
  ParticipantAuthorization: [
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;
export const proofTypes = {
  ProofRelease: [
    { name: 'campaignId', type: 'uint256' },
    { name: 'artworkHash', type: 'bytes32' },
    { name: 'proofHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;
