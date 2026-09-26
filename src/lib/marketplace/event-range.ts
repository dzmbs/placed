// Public Sepolia providers reject large eth_getLogs ranges. Keep scans bounded,
// including after a server restart when the index starts at deployment again.
// Free RPC plans cap the range much lower (Alchemy free: 10 blocks), so shrink
// the span when the provider says so and keep the smaller span afterwards.
const spans = [500n, 100n, 10n];
let level = 0;
const rangeLimited = (error: unknown) =>
  /block range|range (is )?too (large|wide)|limit(ed)? to \d+ blocks?|query returned more than/i.test(
    `${(error as { details?: string })?.details ?? ''} ${error instanceof Error ? error.message : ''}`,
  );
export async function readEventRange<T>(
  fromBlock: bigint,
  toBlock: bigint,
  read: (from: bigint, to: bigint) => Promise<T[]>,
) {
  const logs: T[] = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const span = spans[level];
    const to = from + span - 1n < toBlock ? from + span - 1n : toBlock;
    try {
      logs.push(...(await read(from, to)));
      from = to + 1n;
    } catch (error) {
      if (!rangeLimited(error) || level === spans.length - 1 || to === from) throw error;
      level++;
    }
  }
  return logs;
}
