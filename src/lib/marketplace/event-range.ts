// Public Sepolia providers reject large eth_getLogs ranges. Keep scans bounded,
// including after a server restart when the index starts at deployment again.
export async function readEventRange<T>(
  fromBlock: bigint,
  toBlock: bigint,
  read: (from: bigint, to: bigint) => Promise<T[]>,
) {
  const logs: T[] = [];
  for (let from = fromBlock; from <= toBlock; from += 500n) {
    const to = from + 499n < toBlock ? from + 499n : toBlock;
    logs.push(...(await read(from, to)));
  }
  return logs;
}
