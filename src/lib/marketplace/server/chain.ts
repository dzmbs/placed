import 'server-only';
import { createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { marketplaceChain, marketplaceReady } from '../config';
import { RequestError } from './http';

export const publicClient = createPublicClient({
  chain: marketplaceChain,
  transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com', {
    timeout: 20000,
  }),
});
export function requireDeployment() {
  if (!marketplaceReady)
    throw new RequestError('Marketplace contracts have not been deployed yet.', 503);
}
export function signingAccount(variable: 'PRIVATE_KEY' | 'PROOF_SIGNER_PRIVATE_KEY') {
  const value = process.env[variable];
  if (!value || !/^(0x)?[a-fA-F0-9]{64}$/.test(value))
    throw new RequestError('The backend signing account is not configured.', 503);
  return privateKeyToAccount((value.startsWith('0x') ? value : `0x${value}`) as Hex);
}
