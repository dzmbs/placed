import { erc20Abi } from 'viem';
import { walletAddress } from '@/lib/marketplace/server/auth';
import { publicClient } from '@/lib/marketplace/server/chain';
import { contracts } from '@/lib/marketplace/config';
import { auctionHouseAbi } from '@/lib/marketplace/abi/AuctionHouse';
import { failure } from '@/lib/marketplace/server/http';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  context: RouteContext<'/api/marketplace/wallet/[address]'>,
) {
  try {
    const { address } = await context.params;
    const wallet = walletAddress(address);
    const [usdc, credit, authorized, owner] = await Promise.all([
      publicClient.readContract({
        address: contracts.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [wallet],
      }),
      publicClient.readContract({
        address: contracts.auctionHouse,
        abi: auctionHouseAbi,
        functionName: 'withdrawalCredits',
        args: [wallet],
      }),
      publicClient.readContract({
        address: contracts.auctionHouse,
        abi: auctionHouseAbi,
        functionName: 'authorizedParticipants',
        args: [wallet],
      }),
      publicClient.readContract({
        address: contracts.auctionHouse,
        abi: auctionHouseAbi,
        functionName: 'owner',
      }),
    ]);
    return Response.json({
      usdc: String(usdc),
      credit: String(credit),
      authorized,
      admin: owner.toLowerCase() === wallet.toLowerCase(),
    });
  } catch (error) {
    return failure(error);
  }
}
