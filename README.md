# Placed

Creators list assets. Brands book advertising slots. Investors can buy shares of an asset's advertising revenue.

Upload an outfit photo, generate a rotatable model, mark placements and preview a logo. Run funded USDC auctions with escrow and proof-photo settlement. Financing is optional: a separate **Raise capital** action creates one fixed-supply revenue token and vault per asset, launches it through Uniswap CCA and migrates liquidity to Uniswap v4.

The landing page is at `/`. Browse auctions at `/explore`, prepare an asset at `/studio`, and manage listings, bids and revenue tokens at `/portfolio`. The redesigned UI connects to the Sepolia backend through [one shared adapter](docs/backend-integration.md).

Built with Next.js, React Three Fiber, Solidity, Privy, World ID and ENSv2. The marketplace uses Ethereum Sepolia and a clearly labeled demo USDC token.

**Live demo:** [placed-beige.vercel.app](https://placed-beige.vercel.app). Contracts and addresses are in [docs/contracts.md](docs/contracts.md).

## Hackathon integrations

### Uniswap: CCA launch, v4 liquidity and trading

Each asset can raise capital once. Placed mints a fixed-supply revenue token, sells it through Uniswap's Continuous Clearing Auction, migrates liquidity into a Uniswap v4 pool through the official Liquidity Launchpad strategy and lets holders trade through the Universal Router.

| What                                              | Code                                                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CCA auction created from the official factory     | [AssetLaunchCoordinator.sol:87](contracts/src/AssetLaunchCoordinator.sol#L87), [auction address from the factory at :146](contracts/src/AssetLaunchCoordinator.sol#L146)                            |
| Token distribution through the LBP strategy       | [AssetLaunchCoordinator.sol:163](contracts/src/AssetLaunchCoordinator.sol#L163)                                                                                                                     |
| Migration to v4 and funded LP checks              | [AssetLaunchCoordinator.sol:171](contracts/src/AssetLaunchCoordinator.sol#L171), [recovery at :191](contracts/src/AssetLaunchCoordinator.sol#L191)                                                  |
| Permit2 funding and CCA bids                      | [client.ts:317](src/lib/marketplace/client.ts#L317), [submitBid at :330](src/lib/marketplace/client.ts#L330)                                                                                        |
| Bid exits and token claims                        | [client.ts:344](src/lib/marketplace/client.ts#L344), [claims at :353](src/lib/marketplace/client.ts#L353)                                                                                           |
| v4 quotes and Universal Router swaps              | [trading.ts:16](src/lib/marketplace/server/trading.ts#L16), [encodeTrade at uniswap.ts:76](src/lib/marketplace/uniswap.ts#L76), [executeTrade at client.ts:355](src/lib/marketplace/client.ts#L355) |
| Token sale and trade UI                           | [market-finance.tsx:215](src/components/market-finance.tsx#L215), [trading at :429](src/components/market-finance.tsx#L429)                                                                         |
| Fork tests against the deployed Sepolia contracts | [SepoliaIntegration.t.sol:156](contracts/test/SepoliaIntegration.t.sol#L156), [failed sale at :185](contracts/test/SepoliaIntegration.t.sol#L185)                                                   |

Integration feedback is in [FEEDBACK.md](FEEDBACK.md#uniswap-cca-and-v4).

### World ID: Proof of Human before publishing and bidding

Publishing an asset and placing a funded bid are the two moments where one person running many wallets breaks the market. Both require a backend-verified Proof of Human, turned into an onchain participant voucher. Investing and trading stay permissionless.

| What                                       | Code                                                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDKit widget and error handling            | [context.tsx:287](src/components/marketplace/context.tsx#L287), [error paths at :374](src/components/marketplace/context.tsx#L374)                                      |
| Server-signed, wallet-bound RP request     | [world.ts:48](src/lib/marketplace/server/world.ts#L48)                                                                                                                  |
| Result policy and official v4 verification | [world-policy.ts:12](src/lib/marketplace/world-policy.ts#L12), [world-verifier.ts:30](src/lib/marketplace/world-verifier.ts#L30)                                        |
| One person, one wallet                     | [world.ts:196](src/lib/marketplace/server/world.ts#L196), [world.ts:292](src/lib/marketplace/server/world.ts#L292)                                                      |
| Onchain voucher and gated actions          | [AuctionHouse.sol:136](contracts/src/AuctionHouse.sol#L136), [publish at :146](contracts/src/AuctionHouse.sol#L146), [bid at :197](contracts/src/AuctionHouse.sol#L197) |

Why Proof of Human is the right credential, the success and alternative paths and the staging caveat are in [docs/world-id.md](docs/world-id.md). Our debrief is in [FEEDBACK.md](FEEDBACK.md#world-idkit).

### ENSv2: every asset and slot is a name

`placed-demo.eth` is our ENSv2 parent on Sepolia. Each asset gets its own subregistry (`a1.placed-demo.eth`) and each ad slot gets its own Permissioned Resolver (`s1.a1.placed-demo.eth`). When a brand wins a slot, Enhanced Access Control grants that wallet the setter role for one text record, `ad.artwork`, on that one resolver. It cannot touch other keys or other slots. The role is revoked when the campaign completes or is refunded. The app reads listings by walking the ENSv2 hierarchy, not from a private database.

| What                                            | Code                                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset subregistry and resolver                  | [ENSAssetRegistry.sol:60](contracts/src/ENSAssetRegistry.sol#L60), [registry deployment at :107](contracts/src/ENSAssetRegistry.sol#L107)                              |
| Slot subname with its own Permissioned Resolver | [ENSAssetRegistry.sol:74](contracts/src/ENSAssetRegistry.sol#L74), [resolver deployment at :117](contracts/src/ENSAssetRegistry.sol#L117)                              |
| Winner gets only the `ad.artwork` role          | [ENSAssetRegistry.sol:88](contracts/src/ENSAssetRegistry.sol#L88)                                                                                                      |
| Role revoked at completion or refund            | [ENSAssetRegistry.sol:97](contracts/src/ENSAssetRegistry.sol#L97)                                                                                                      |
| Revenue token recorded on the asset name        | [ENSAssetRegistry.sol:103](contracts/src/ENSAssetRegistry.sol#L103)                                                                                                    |
| Reading through the hierarchy and `resolve`     | [reader.ts:27](src/lib/marketplace/server/reader.ts#L27), [slot reads at :102](src/lib/marketplace/server/reader.ts#L102), [ens.ts:17](src/lib/marketplace/ens.ts#L17) |
| Fork test: scoped write and revocation          | [SepoliaIntegration.t.sol:90](contracts/test/SepoliaIntegration.t.sol#L90)                                                                                             |

Integration feedback is in [FEEDBACK.md](FEEDBACK.md#ensv2).

## Run locally

You need Node.js 22.19 or newer.

```sh
git clone https://github.com/dzmbs/placed.git
cd placed
npm ci
cp .env.example .env.local
npm run dev
```

Open the [landing page](http://127.0.0.1:3000), [marketplace](http://127.0.0.1:3000/explore) or [3D studio](http://127.0.0.1:3000/studio). Models and Blender sources are included. The studio and prepared examples work without credentials.

For image-to-3D, set `TRIPO_API_KEY` and `GENERATION_ENABLED=true`. The standalone studio also supports Meshy. Generation uses provider credits. `OPENAI_API_KEY` enables proof-photo matching.

Set `NEXT_PUBLIC_PRIVY_APP_ID` and allow the exact origin `http://127.0.0.1:3000` in the Privy dashboard for wallet connection. `localhost` and `127.0.0.1` are separate origins. A Privy app secret is not used by the browser.

Publishing and advertising bids require backend-verified World Proof of Human and a connected Sepolia wallet. Configure World credentials and contract signers using [the integration guide](docs/integrations.md). Open the wallet button for **Get demo USDC**, **Change wallet** and verification. Investors do not need World verification.

The studio saves drafts in your browser. The marketplace stores media, sessions and proof results under `data/`; asset records and payments live on Sepolia. Back up `data/` and keep it persistent when hosting. Set `APP_ORIGIN` to the public application URL before publishing media references.

## Development

Run `npm run check` for formatting, types, JavaScript tests, model verification and a production build. With [Foundry](https://getfoundry.sh/) installed:

```sh
npm run contracts:setup
npm run contracts:test
npm run contracts:fork
```

The fork tests exercise the official Sepolia ENSv2 and Uniswap deployments, including a successful CCA sale, token claims, funded pool migration, a v4 swap and failed-sale refunds. They do not broadcast transactions. For local HTTP checks, run `npm run verify:marketplace` with the dev server running.

See [contracts and deployed addresses](docs/contracts.md), [integration setup](docs/integrations.md), [World ID](docs/world-id.md), [demo walkthrough](docs/demo.md) and [integration feedback](FEEDBACK.md).

Core implementation: [advertising auctions](contracts/src/AuctionHouse.sol#L193), [CCA launch and migration](contracts/src/AssetLaunchCoordinator.sol#L87), [revenue redemption](contracts/src/AssetRevenueVault.sol#L99) and [v4 quotes](src/lib/marketplace/server/trading.ts#L16).

See [the asset workflow](docs/assets.md) for editing the included models and Blender sources, and [asset licenses](public/models/humans/LICENSES.md) for attribution.

This is a testnet MVP. A photo cannot establish display duration. The backend proof signer and refund admin are explicit trust dependencies. Real-money revenue-share distribution needs legal review.
