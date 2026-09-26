# Contracts and evidence

Ethereum Sepolia, chain ID `11155111`. All payments use our faucet-backed demo USDC, not mainnet USDC. The current deployment is recorded in [deployment.json](../src/lib/marketplace/deployment.json).

| Component                    | Sepolia address                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AuctionHouse                 | [`0x3111e02cf4b866c94a02fceeda67d4ba1f941cc4`](https://sepolia.etherscan.io/address/0x3111e02cf4b866c94a02fceeda67d4ba1f941cc4) |
| Demo USDC                    | [`0x6919bfbdf235ca7d6e82d40e7fba198510c1357d`](https://sepolia.etherscan.io/address/0x6919bfbdf235ca7d6e82d40e7fba198510c1357d) |
| AssetLaunchCoordinator       | [`0x71340890fed543d6604d3190f35c1c94bb8832f1`](https://sepolia.etherscan.io/address/0x71340890fed543d6604d3190f35c1c94bb8832f1) |
| ENSAssetRegistry             | [`0x211baf185721e60c2793cd0b3b78db7f4cc7b75f`](https://sepolia.etherscan.io/address/0x211baf185721e60c2793cd0b3b78db7f4cc7b75f) |
| Official CCA factory, 2.1.0  | `0x000000001F26a0044BaA66024e7b6599c61963F8`                                                                                    |
| Official LBP strategy, 3.3.0 | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`                                                                                    |
| v4 PositionManager           | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4`                                                                                    |
| v4 PoolManager               | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`                                                                                    |
| Universal Router, 2.0.0      | `0x470FFC67b1feEEC31D16C46AC7545C98716a194c`                                                                                    |
| v4 Quoter                    | `0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227`                                                                                    |
| v4 StateView                 | `0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C`                                                                                    |
| Permit2                      | `0x000000000022D473030F116dDEE9F6B43aC78BA3`                                                                                    |

The parent is `placed-demo.eth` on ENSv2 Sepolia. Each asset receives a child registry, each slot a dedicated resolver. These addresses and revenue-token/vault/CCA/pool addresses are created when users publish or explicitly launch financing; they are not fabricated listings in the frontend.

## Source map

| Behavior                                          | Source                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Funded advertising bids and withdrawal credits    | [AuctionHouse.sol:193](../contracts/src/AuctionHouse.sol#L193)                                                      |
| Finalization and creator/vault split              | [AuctionHouse.sol:233](../contracts/src/AuctionHouse.sol#L233)                                                      |
| One-time proof release and manual refund          | [AuctionHouse.sol:252](../contracts/src/AuctionHouse.sol#L252)                                                      |
| Fixed token supply and immutable revenue terms    | [AssetRevenueVault.sol](../contracts/src/AssetRevenueVault.sol)                                                     |
| Maturity gate and proportional burn/redemption    | [AssetRevenueVault.sol:99](../contracts/src/AssetRevenueVault.sol#L99)                                              |
| Actual CCA allocation and strategy initialization | [AssetLaunchCoordinator.sol:87](../contracts/src/AssetLaunchCoordinator.sol#L87)                                    |
| Migration, funded LP validation and activation    | [AssetLaunchCoordinator.sol:171](../contracts/src/AssetLaunchCoordinator.sol#L171)                                  |
| Dedicated resolver artwork permissions/revocation | [ENSAssetRegistry.sol:88](../contracts/src/ENSAssetRegistry.sol#L88)                                                |
| Hierarchical ENS metadata and token resolution    | [reader.ts:152](../src/lib/marketplace/server/reader.ts#L152)                                                       |
| Executable v4 quote, fees and minimum received    | [trading.ts:16](../src/lib/marketplace/server/trading.ts#L16), [router encoding](../src/lib/marketplace/uniswap.ts) |
| Wallet-bound World verification and vouchers      | [world.ts:76](../src/lib/marketplace/server/world.ts#L76)                                                           |
| AI photo decision and proof authorization         | [proof.ts](../src/lib/marketplace/server/proof.ts), [vision matching](../src/lib/marketplace/proof-matching.ts)     |

The data model has four levels: creator, asset, slot and campaign. Asset financing binds one fixed series to the asset. Creating a slot never mints tokens. Campaigns snapshot the series and share when created, so pre-activation campaigns retain their original payment terms.

## Accounting

USDC uses six decimal places. Bid increments round up, with at least one smallest unit. The immediately released amount rounds down; held escrow is the remainder. Each released amount's vault share rounds down, and the creator receives the remainder. These splits always add up to the released payment.

Open funded bids, outbid credits and held campaign escrow have separate AuctionHouse ledgers. Vault revenue is received and accounted in the asset vault. CCA payments and LP reserves have official launch custodians. Refunds can access only the campaign's held balance. Redemption uses remaining accounted revenue and remaining token supply, so the final redeemer receives rounding dust.

CCA protocol fees come from the official factory's fee controller, or from the actual sweep after migration. The deployed factory currently has a zero fee-controller address. The application checks this state rather than assuming every release has zero fees. It displays liquidity and proceeds estimates before migration, then transferred creator proceeds and actual pool currency funding from receipt events.

## Validation and public transactions

- [17 contract tests](../contracts/test/AuctionHouse.t.sol), including 256 fuzz runs for payment conservation, independent slots, future-slot coverage, transferred token entitlement and settlement-gated redemption.
- [Five Sepolia fork tests](../contracts/test/SepoliaIntegration.t.sol#L90): scoped ENS writes/revocation, real two-investor CCA allocations/claims plus a funded v4 pool and swap, failed fundraising/refunds, recovery of unused token reserves, and recognition of direct official migration. Fork tests run against real deployed code without broadcasting transactions.
- [JavaScript policy/encoding tests](../tests/marketplace.test.ts), plus [local HTTP checks](../scripts/verify_marketplace_api.ts) for signed sessions, replay rejection, World request/rejection, protected authorization, immutable media and chain reads.

The latest public deployment transactions are in the manifest. [AuctionHouse deployment](https://sepolia.etherscan.io/tx/0x7077a60f06eae823578980202e8b92138f2de190118b87ece357f8d6000df934), [launch coordinator deployment](https://sepolia.etherscan.io/tx/0x661b5aab4d2fbfac2945ed8aee38342c24f40a85ff705334e14693cca4e62a76), [ENS service deployment](https://sepolia.etherscan.io/tx/0x7cc04f00351b48370c5a995f730434cdf213f616c93f4bb93a6d60a49fc3a957), [ENS parent registry binding](https://sepolia.etherscan.io/tx/0x5f28f6de6bfa5c1f6a8eb8f4da37c5fcfc5e11398867cefeb10f3f87a554ad21), [service configuration](https://sepolia.etherscan.io/tx/0xc0437d4a64733dc93cdef21c507f61f91b7fa2ebc14c06e1c77130b79f737b09).

Public human verification, CCA investment, trading, advertising fulfillment and redemption transaction evidence is pending. Do not present fork traces as public demo transactions. Follow [the demo walkthrough](demo.md) to record those remaining steps.
