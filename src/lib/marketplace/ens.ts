import {
  decodeFunctionResult,
  encodeFunctionData,
  namehash,
  parseAbi,
  toHex,
  type Address,
  type PublicClient,
} from 'viem';
import { packetToBytes } from 'viem/ens';

export const ensResolverAbi = parseAbi([
  'function resolve(bytes name,bytes data) view returns(bytes)',
]);
export const ensTextAbi = parseAbi(['function text(bytes32 node,string key) view returns(string)']);

export async function readEnsText(
  client: Pick<PublicClient, 'readContract'>,
  resolver: Address,
  name: string,
  key: string,
) {
  const data = await client.readContract({
    address: resolver,
    abi: ensResolverAbi,
    functionName: 'resolve',
    args: [
      toHex(packetToBytes(name)),
      encodeFunctionData({ abi: ensTextAbi, functionName: 'text', args: [namehash(name), key] }),
    ],
  });
  return decodeFunctionResult({ abi: ensTextAbi, functionName: 'text', data });
}
