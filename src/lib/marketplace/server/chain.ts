import 'server-only';
import { createPublicClient, fallback, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { marketplaceChain, marketplaceReady } from '../config';
import { RequestError } from './http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ReadCache } from '../read-cache';
import { encodeIndexValue } from '../event-index';

const rpcClient = createPublicClient({
  chain: marketplaceChain,
  batch: { multicall: { wait: 20 } },
  transport: rpcTransport(),
});
// eth_getLogs is the expensive call (75 CU on Alchemy, capped at 10 blocks on
// its free plan). PublicNode and Tenderly serve 50,000-block ranges for free,
// so log scans go there first and only fall back to the primary provider.
export const logsClient = createPublicClient({
  chain: marketplaceChain,
  transport: rpcTransport([
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    process.env.SEPOLIA_RPC_URL,
  ]),
});
// Free RPC plans rate-limit (429) under several testers polling at once, so
// fall through to public Sepolia endpoints instead of failing every request.
function rpcTransport(
  candidates = [
    process.env.SEPOLIA_RPC_URL,
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
  ],
) {
  const urls = candidates.filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);
  return fallback(
    urls.map((url) =>
      http(url, {
        timeout: 20000,
        retryCount: 0,
        onFetchRequest: (request) => countRpc(new URL(url).host, request),
      }),
    ),
    { retryCount: 1 },
  );
}
// Per-minute RPC usage by provider host and method, to see what spends the
// provider's rate limit. Hosts only: provider URLs can embed API keys.
const rpcUsage = new Map<string, number>();
function countRpc(host: string, request: Request) {
  void request
    .clone()
    .json()
    .then((body: { method?: string } | { method?: string }[]) => {
      for (const call of Array.isArray(body) ? body : [body]) {
        const key = `${host} ${call.method ?? '?'}`;
        rpcUsage.set(key, (rpcUsage.get(key) ?? 0) + 1);
      }
    })
    .catch(() => {});
}
setInterval(() => {
  if (!rpcUsage.size) return;
  console.info('[rpc] last minute', Object.fromEntries(rpcUsage));
  rpcUsage.clear();
}, 60000).unref();
const scope = new AsyncLocalStorage<{ number: bigint; hash?: string }>();
const reads = new ReadCache(2048);
// Pin related contract reads to one block and reuse identical reads across
// assets, launches and wallets. Unscoped transaction validation stays fresh.
export const publicClient = new Proxy(rpcClient, {
  get(target, method, receiver) {
    if (!['readContract', 'multicall', 'getBlock'].includes(String(method)))
      return Reflect.get(target, method, receiver);
    return (input: Record<string, unknown> = {}) => {
      const context = scope.getStore();
      const blockNumber = context?.number;
      const args =
        blockNumber !== undefined &&
        input.blockNumber === undefined &&
        !input.blockHash &&
        !input.blockTag
          ? { ...input, blockNumber }
          : input;
      const action = Reflect.get(target, method) as (args: unknown) => Promise<unknown>;
      // Block hashes are checked again on advancement for reorg detection.
      const key = `${context?.hash || ''}:${String(method)}:${encodeIndexValue(args)}`;
      if (method === 'getBlock') return reads.read(key, () => action(args), 2000);
      if (args.blockNumber !== undefined) return reads.read(key, () => action(args), 30000);
      return action(args);
    };
  },
});
export const atBlock = <T>(block: bigint, load: () => Promise<T>, hash?: string) =>
  scope.run({ number: block, hash }, load);
export const currentReadBlock = () => scope.getStore();
const heads = new ReadCache(2);
export async function latestBlock(minimum = 0n) {
  let block = await heads.read('head', () => rpcClient.getBlock(), 2000);
  if (block.number < minimum) block = await heads.read('fresh', () => rpcClient.getBlock(), 500);
  if (block.number < minimum)
    throw new RequestError(
      'Your transaction is confirmed. The market index is catching up; refresh shortly.',
      503,
    );
  return block;
}
export function minimumBlock(request: Request) {
  const value = new URL(request.url).searchParams.get('minimumBlock');
  if (value && !/^\d{1,16}$/.test(value)) throw new RequestError('Invalid confirmation block.');
  return BigInt(value || '0');
}
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
