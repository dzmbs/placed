import {
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';

export const universalRouter = '0x470FFC67b1feEEC31D16C46AC7545C98716a194c' as Address;
export const v4Quoter = '0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227' as Address;
export const stateView = '0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C' as Address;
export const permit2Abi = parseAbi([
  'function approve(address token,address spender,uint160 amount,uint48 expiration)',
  'function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)',
]);
export const ccaAbi = parseAbi([
  'function submitBid(uint256 maxPriceQ96,uint128 amount,address owner,bytes hookData) returns(uint256)',
  'function exitBid(uint256 id)',
  'function exitPartiallyFilledBid(uint256 id,uint64 lastFullyFilledCheckpointBlock,uint64 outbidBlock)',
  'function claimTokens(uint256 id)',
  'function checkpoint()',
  'function startBlock() view returns(uint64)',
  'function endBlock() view returns(uint64)',
  'function claimBlock() view returns(uint64)',
  'function floorPrice() view returns(uint256)',
  'function tickSpacing() view returns(uint256)',
  'function clearingPrice() view returns(uint256)',
  'function currencyRaised() view returns(uint256)',
  'function isGraduated() view returns(bool)',
  'function sweepCurrencyBlock() view returns(uint256)',
  'function sweepUnsoldTokensBlock() view returns(uint256)',
  'function sweepUnsoldTokens()',
  'event CurrencySwept(address indexed fundsRecipient,uint256 amount)',
  'function lastCheckpointedBlock() view returns(uint64)',
  'function checkpoints(uint64 blockNumber) view returns((uint256 clearingPrice,uint256 currencyRaisedAtClearingPriceQ96X7,uint256 cumulativeMpsPerPrice,uint24 cumulativeMps,uint64 prev,uint64 next))',
  'function bids(uint256 id) view returns((uint64 startBlock,uint24 startCumulativeMps,uint64 exitedBlock,uint256 maxPrice,address owner,uint256 amountQ96,uint256 tokensFilled))',
  'event BidSubmitted(uint256 indexed id,address indexed owner,uint256 priceQ96,uint128 amount)',
  'event BidExited(uint256 indexed bidId,address indexed owner,uint256 tokensFilled,uint256 currencyRefunded)',
  'event TokensClaimed(uint256 indexed bidId,address indexed owner,uint256 tokensFilled)',
  'event CheckpointUpdated(uint256 blockNumber,uint256 clearingPriceQ96,uint24 cumulativeMps)',
]);
export const positionManagerAbi = parseAbi([
  'function getPoolAndPositionInfo(uint256 id) view returns((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint256)',
]);
export const quoterAbi = parseAbi([
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns(uint256 amountOut,uint256 gasEstimate)',
]);
export const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) view returns(uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
]);
export const routerAbi = parseAbi([
  'function execute(bytes commands,bytes[] inputs,uint256 deadline) payable',
]);
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}
export interface TradeQuote {
  assetId: string;
  inputToken: Address;
  outputToken: Address;
  amountIn: string;
  amountOut: string;
  minimumOut: string;
  deadline: number;
  poolKey: PoolKey;
  zeroForOne: boolean;
  feePips: number;
  priceImpactBps: number;
  gasEstimate: string;
}
export function encodeTrade(quote: TradeQuote): Hex {
  const key = quote.poolKey;
  const params = [
    encodeAbiParameters(
      parseAbiParameters(
        '((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)',
      ),
      [
        {
          poolKey: key,
          zeroForOne: quote.zeroForOne,
          amountIn: BigInt(quote.amountIn),
          amountOutMinimum: BigInt(quote.minimumOut),
          hookData: '0x',
        },
      ],
    ),
    encodeAbiParameters(parseAbiParameters('address,uint256'), [
      quote.inputToken,
      BigInt(quote.amountIn),
    ]),
    encodeAbiParameters(parseAbiParameters('address,uint256'), [
      quote.outputToken,
      BigInt(quote.minimumOut),
    ]),
  ];
  const input = encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), ['0x060c0f', params]);
  return encodeFunctionData({
    abi: routerAbi,
    functionName: 'execute',
    args: ['0x10', [input], BigInt(quote.deadline)],
  });
}
