// Public Sepolia providers reject large eth_getLogs ranges. Keep scans bounded,
// including after a server restart when the index starts at deployment again.
// Free plans differ widely (PublicNode/Tenderly: 50,000 blocks, Alchemy: 10),
// so start wide, shrink when a provider refuses, and keep the smaller span.
export const DEFAULT_SPANS = [50000n, 10000n, 500n, 100n, 10n];
const rangeLimited = (error: unknown) =>
  /block range|range (is )?too (large|wide)|ranges over \d+ blocks|limit(ed)? to \d+ blocks?|query returned more than/i.test(
    `${(error as { details?: string })?.details ?? ''} ${error instanceof Error ? error.message : ''}`,
  );
export async function readEventRange<T>(
  fromBlock: bigint,
  toBlock: bigint,
  read: (from: bigint, to: bigint) => Promise<T[]>,
  spans = DEFAULT_SPANS,
) {
  // Shrinking lasts for this scan only: the fallback transport may reach a
  // wide-range provider again next time.
  let level = 0;
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
