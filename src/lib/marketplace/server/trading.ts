import 'server-only';
import { parseUnits } from 'viem';
import { readAsset, chainId } from './reader';
import { publicClient } from './chain';
import { contracts } from '../config';
import {
  v4Quoter,
  stateView,
  quoterAbi,
  stateViewAbi,
  positionManagerAbi,
  type TradeQuote,
} from '../uniswap';
import { RequestError } from './http';

export async function quoteTrade(
  assetId: string,
  side: string,
  value: string,
  slippageBps: number,
): Promise<TradeQuote> {
  const asset = await readAsset(chainId(assetId));
  const series = asset.financing;
  if (!series?.activated || series.positionId === '0')
    throw new RequestError('This asset has no active trading pool.');
  if (
    !['buy', 'sell'].includes(side) ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500 ||
    !/^\d+(\.\d{1,18})?$/.test(value)
  )
    throw new RequestError('Invalid trade or slippage.');
  if (side === 'buy' && value.includes('.') && value.split('.')[1].length > 6)
    throw new RequestError('Demo USDC has six decimal places.');
  const amount = parseUnits(value, side === 'buy' ? 6 : 18);
  if (amount <= 0n || amount >= 2n ** 128n) throw new RequestError('Invalid trade amount.');
  const [key] = await publicClient.readContract({
    address: contracts.positionManager,
    abi: positionManagerAbi,
    functionName: 'getPoolAndPositionInfo',
    args: [BigInt(series.positionId)],
  });
  const inputToken = side === 'buy' ? contracts.usdc : series.token;
  const outputToken = side === 'buy' ? series.token : contracts.usdc;
  if (
    ![key.currency0.toLowerCase(), key.currency1.toLowerCase()].includes(
      inputToken.toLowerCase(),
    ) ||
    ![key.currency0.toLowerCase(), key.currency1.toLowerCase()].includes(outputToken.toLowerCase())
  )
    throw new RequestError('Pool currencies do not match the asset.');
  const zeroForOne = key.currency0.toLowerCase() === inputToken.toLowerCase();
  const [quote, state] = await Promise.all([
    publicClient.simulateContract({
      address: v4Quoter,
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ poolKey: key, zeroForOne, exactAmount: amount, hookData: '0x' }],
    }),
    publicClient.readContract({
      address: stateView,
      abi: stateViewAbi,
      functionName: 'getSlot0',
      args: [series.poolId],
    }),
  ]);
  const [out, gas] = quote.result;
  if (out === 0n) throw new RequestError('This trade is too small to receive tokens.');
  const squaredPrice = state[0] * state[0];
  const protocolFee = zeroForOne ? state[2] & 0xfff : state[2] >> 12;
  const feePips = protocolFee + state[3] - Math.floor((protocolFee * state[3]) / 1e6);
  const spot = zeroForOne
    ? (amount * squaredPrice) / (1n << 192n)
    : (amount * (1n << 192n)) / squaredPrice;
  const afterFee = (spot * BigInt(1e6 - feePips)) / 1_000_000n;
  const impact =
    afterFee > out && afterFee > 0n ? Number(((afterFee - out) * 10000n) / afterFee) : 0;
  return {
    assetId,
    inputToken,
    outputToken,
    amountIn: String(amount),
    amountOut: String(out),
    minimumOut: String((out * BigInt(10000 - slippageBps)) / 10000n),
    deadline: Math.floor(Date.now() / 1000) + 300,
    poolKey: key,
    zeroForOne,
    feePips,
    priceImpactBps: impact,
    gasEstimate: String(gas),
  };
}
