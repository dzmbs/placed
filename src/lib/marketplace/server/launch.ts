import 'server-only';
import {
  decodeAbiParameters,
  decodeEventLog,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
  type Address,
} from 'viem';
import { publicClient } from './chain';
import { readAsset, chainId } from './reader';
import { contracts, deploymentBlock } from '../config';
import { ccaAbi } from '../uniswap';
import { RequestError } from './http';

const factoryAbi = parseAbi([
  'function protocolFeeController() view returns(address)',
  'event AuctionCreated(address indexed auction,address indexed token,uint256 amount,bytes configData)',
]);
const feeAbi = parseAbi([
  'function getProtocolFeeAmount(address currency,uint256 amount) view returns(uint256)',
]);
const paramsType = parseAbiParameters(
  '(address currency,address tokensRecipient,address fundsRecipient,uint64 startBlock,uint64 endBlock,uint64 claimBlock,uint256 tickSpacing,address validationHook,uint256 floorPrice,uint128 requiredCurrencyRaised,bytes auctionStepsData)',
);
export async function readLaunch(assetId: string, wallet?: Address) {
  const asset = await readAsset(chainId(assetId));
  if (!asset.financing) throw new RequestError('This asset has no financing launch.', 404);
  const { auction } = asset.financing;
  const names = [
    'startBlock',
    'endBlock',
    'claimBlock',
    'floorPrice',
    'tickSpacing',
    'clearingPrice',
    'currencyRaised',
    'isGraduated',
    'lastCheckpointedBlock',
    'sweepCurrencyBlock',
    'sweepUnsoldTokensBlock',
  ] as const;
  const values = await publicClient.multicall({
    allowFailure: false,
    contracts: names.map((functionName) => ({ address: auction, abi: ccaAbi, functionName })),
  });
  const block = await publicClient.getBlockNumber();
  const creation = await publicClient.getContractEvents({
    address: contracts.ccaFactory,
    abi: factoryAbi,
    eventName: 'AuctionCreated',
    args: { auction },
    fromBlock: deploymentBlock,
    toBlock: block,
  });
  if (!creation[0]?.args.configData)
    throw new RequestError('The CCA launch configuration could not be indexed.', 503);
  const [configuration] = decodeAbiParameters(paramsType, creation[0].args.configData);
  const controller = await publicClient.readContract({
    address: contracts.ccaFactory,
    abi: factoryAbi,
    functionName: 'protocolFeeController',
  });
  const gross = BigInt(values[6]);
  let fee =
    controller === zeroAddress
      ? 0n
      : await publicClient.readContract({
          address: controller,
          abi: feeAbi,
          functionName: 'getProtocolFeeAmount',
          args: [contracts.usdc, gross],
        });
  if (fee > gross) fee = gross;
  let creatorProceeds: string | undefined, liquidityFunding: string | undefined;
  if (BigInt(values[9]) > 0n) {
    const sweeps = await publicClient.getContractEvents({
      address: auction,
      abi: ccaAbi,
      eventName: 'CurrencySwept',
      fromBlock: configuration.endBlock,
      toBlock: block,
    });
    const sweep = sweeps[0];
    if (sweep?.transactionHash && sweep.args.amount !== undefined) {
      const netReceived = sweep.args.amount;
      fee = Boolean(values[7]) ? gross - netReceived : 0n;
      const receipt = await publicClient.getTransactionReceipt({ hash: sweep.transactionHash });
      const abi = parseAbi(['event CurrencySwept(address indexed recipient,uint256 amount)']);
      let paid = 0n;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contracts.lbpStrategy.toLowerCase()) continue;
        try {
          const event = decodeEventLog({ abi, data: log.data, topics: log.topics });
          if (event.args.recipient.toLowerCase() === asset.creator.wallet.toLowerCase())
            paid += event.args.amount;
        } catch {
          /* Other strategy events are unrelated to this payout. */
        }
      }
      creatorProceeds = String(paid);
      liquidityFunding = String(netReceived - paid);
    }
  }
  const net =
    block >= configuration.endBlock && BigInt(values[8]) >= configuration.endBlock && !values[7]
      ? 0n
      : gross - fee;
  const liquidity = (net * BigInt(asset.financing.liquidityCurrencyMps)) / 10_000_000n;
  const ownerLogs =
    wallet && block >= configuration.startBlock
      ? await publicClient.getContractEvents({
          address: auction,
          abi: ccaAbi,
          eventName: 'BidSubmitted',
          args: { owner: wallet },
          fromBlock: configuration.startBlock,
          toBlock: block,
        })
      : [];
  const bids = await Promise.all(
    ownerLogs.map(async (log) => {
      const id = log.args.id!;
      const bid = await publicClient.readContract({
        address: auction,
        abi: ccaAbi,
        functionName: 'bids',
        args: [id],
      });
      const [exits, claims] = await Promise.all([
        publicClient.getContractEvents({
          address: auction,
          abi: ccaAbi,
          eventName: 'BidExited',
          args: { bidId: id },
          fromBlock: configuration.startBlock,
          toBlock: block,
        }),
        publicClient.getContractEvents({
          address: auction,
          abi: ccaAbi,
          eventName: 'TokensClaimed',
          args: { bidId: id },
          fromBlock: configuration.startBlock,
          toBlock: block,
        }),
      ]);
      let hints: { last: string; outbid: string } | undefined;
      if (Boolean(values[7]) && bid.exitedBlock === 0n && bid.maxPrice <= BigInt(values[5])) {
        let cursor = BigInt(values[8]);
        let outbid = 0n;
        for (let count = 0; count < 1000 && cursor >= bid.startBlock; count++) {
          const cp = await publicClient.readContract({
            address: auction,
            abi: ccaAbi,
            functionName: 'checkpoints',
            args: [cursor],
          });
          if (cp.clearingPrice > bid.maxPrice) outbid = cursor;
          if (cp.clearingPrice < bid.maxPrice) {
            hints = { last: String(cursor), outbid: String(outbid) };
            break;
          }
          if (cp.prev >= cursor) break;
          cursor = cp.prev;
        }
      }
      return {
        id: String(id),
        budget: String(bid.amountQ96 >> 96n),
        maxPrice: String(bid.maxPrice),
        exited: bid.exitedBlock !== 0n,
        tokensFilled: String(bid.tokensFilled),
        refunded: exits[0] ? String(exits[0].args.currencyRefunded) : undefined,
        allocated: exits[0] ? String(exits[0].args.tokensFilled) : undefined,
        claimed: claims.length > 0,
        hints,
      };
    }),
  );
  return {
    block: String(block),
    startBlock: String(values[0]),
    endBlock: String(values[1]),
    claimBlock: String(values[2]),
    floorPrice: String(values[3]),
    tickSpacing: String(values[4]),
    clearingPrice: String(values[5]),
    grossRaised: String(gross),
    fee: String(fee),
    liquidityEstimate: String(liquidity),
    creatorProceedsEstimate: String(net - liquidity),
    creatorProceeds,
    liquidityFunding,
    minimumRaise: String(configuration.requiredCurrencyRaised),
    graduated: Boolean(values[7]),
    checkpointBlock: String(values[8]),
    swept: BigInt(values[9]) > 0n,
    unsoldSwept: BigInt(values[10]) > 0n,
    bids,
  };
}
export type LaunchStatus = Awaited<ReturnType<typeof readLaunch>>;
