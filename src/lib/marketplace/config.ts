import { getAddress, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import deployment from './deployment.json';

export const marketplaceChain = sepolia;
export const contracts = {
  auctionHouse: getAddress(deployment.auctionHouse),
  usdc: getAddress(deployment.demoUSDC),
  launchCoordinator: getAddress(deployment.launchCoordinator),
  naming: getAddress(deployment.ensRegistry),
  ccaFactory: getAddress(deployment.ccaFactory),
  lbpStrategy: getAddress(deployment.lbpStrategy),
  positionManager: getAddress(deployment.positionManager),
  permit2: getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3'),
};
export const ensParent = deployment.ensParent;
export const marketplaceReady =
  deployment.status === 'deployed' && contracts.auctionHouse !== zeroAddress;
export const deploymentBlock = BigInt(deployment.startBlock);
export function auctionDomain() {
  return {
    name: 'PlacedAuctionHouse',
    version: '1',
    chainId: marketplaceChain.id,
    verifyingContract: contracts.auctionHouse,
  } as const;
}
