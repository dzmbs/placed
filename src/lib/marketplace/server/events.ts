import 'server-only';
import type { Abi, Address, ContractEventName, GetContractEventsReturnType } from 'viem';
import { EventIndex } from '../event-index';
import { database } from './database';
import { publicClient, currentReadBlock } from './chain';
import { marketplaceChain, deploymentBlock, contracts } from '../config';
import { ReadCache } from '../read-cache';
import { createHash } from 'node:crypto';

let index: EventIndex | undefined;
const reads = new ReadCache(256);
// Never include owner/bid filters in a stream: download each event once, then
// query it locally for every wallet. The database survives dev and deploy restarts.
export async function indexedEvents<
  const A extends Abi,
  N extends ContractEventName<A> | undefined = undefined,
>(params: {
  address: Address;
  abi: A;
  eventName?: N;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<GetContractEventsReturnType<A, N, true, bigint, bigint>> {
  index ??= new EventIndex(database());
  const names = params.abi
    .filter((item) => item.type === 'event')
    .map((item) => JSON.stringify(item))
    .sort()
    .join('|');
  const schema = createHash('sha256')
    .update(`${params.eventName || '*'}:${names}`)
    .digest('hex');
  const stream = `${marketplaceChain.id}:${contracts.auctionHouse.toLowerCase()}:${deploymentBlock}:${params.address.toLowerCase()}:${schema}:${params.fromBlock}`;
  return reads.read(
    `${stream}:${params.toBlock}:${currentReadBlock()?.hash || ''}`,
    () =>
      index!.read(
        stream,
        params.fromBlock,
        params.toBlock,
        (fromBlock, toBlock) =>
          publicClient.getContractEvents({ ...params, fromBlock, toBlock, strict: true }),
        async (blockNumber) => (await publicClient.getBlock({ blockNumber })).hash,
      ),
    2000,
    5000,
  );
}
