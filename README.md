# Placed

Creators list assets. Brands book advertising slots. Investors can buy shares of an asset's advertising revenue.

Upload an outfit photo, generate a rotatable model, mark placements and preview a logo. Run funded USDC auctions with escrow and proof-photo settlement. Financing is optional: a separate **Raise capital** action creates one fixed-supply revenue token and vault per asset, launches it through Uniswap CCA and migrates liquidity to Uniswap v4.

Built with Next.js, React Three Fiber, Solidity, Privy, World ID and ENSv2. The marketplace uses Ethereum Sepolia and a clearly labeled demo USDC token.

## Run locally

You need Node.js 22.19 or newer.

```sh
git clone https://github.com/dzmbs/placed.git
cd placed
npm ci
cp .env.example .env.local
npm run dev
```

Open the [marketplace](http://127.0.0.1:3000/marketplace) or [3D studio](http://127.0.0.1:3000). Models and Blender sources are included. The studio and prepared examples work without credentials.

For image-to-3D, set `TRIPO_API_KEY` and `GENERATION_ENABLED=true`. The standalone studio also supports Meshy. Generation uses provider credits. `OPENAI_API_KEY` enables proof-photo matching.

Set `NEXT_PUBLIC_PRIVY_APP_ID` and allow the exact origin `http://127.0.0.1:3000` in the Privy dashboard for wallet connection. `localhost` and `127.0.0.1` are separate origins. A Privy app secret is not used by the browser.

Publishing and advertising bids require backend-verified World Proof of Human and a connected Sepolia wallet. Configure World credentials and contract signers using [the integration guide](docs/integrations.md). Use **Get demo USDC** after connecting. Investors do not need World verification.

The studio saves drafts in your browser. The marketplace stores media, sessions and proof results under `data/`; asset records and payments live on Sepolia. Back up `data/` and keep it persistent when hosting. Set `APP_ORIGIN` to the public application URL before publishing media references.

## Development

Run `npm run check` for formatting, types, JavaScript tests, model verification and a production build. With [Foundry](https://getfoundry.sh/) installed:

```sh
npm run contracts:setup
npm run contracts:test
npm run contracts:fork
```

The fork tests exercise the official Sepolia ENSv2 and Uniswap deployments, including a successful CCA sale, token claims, funded pool migration, a v4 swap and failed-sale refunds. They do not broadcast transactions. For local HTTP checks, run `npm run verify:marketplace` with the dev server running.

See [contracts and deployed addresses](docs/contracts.md), [integration setup](docs/integrations.md), [demo walkthrough](docs/demo.md) and [integration feedback](FEEDBACK.md). Live human verification and public sale/trade transaction evidence are still required before a hackathon submission.

Core implementation: [advertising auctions](contracts/src/AuctionHouse.sol#L193), [CCA launch and migration](contracts/src/AssetLaunchCoordinator.sol#L87), [revenue redemption](contracts/src/AssetRevenueVault.sol#L99) and [v4 quotes](src/lib/marketplace/server/trading.ts#L16).

See [the asset workflow](docs/assets.md) for editing the included models and Blender sources, and [asset licenses](public/models/humans/LICENSES.md) for attribution.

This is a testnet MVP. A photo cannot establish display duration. The backend proof signer and refund admin are explicit trust dependencies. Real-money revenue-share distribution needs legal review.
