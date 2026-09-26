# Testnet integrations

The MVP uses Ethereum Sepolia only, chain ID `11155111`. ENSv2 naming, advertising settlement, asset financing and Uniswap trading all use this network. World ID proofs are verified by the backend and authorize participant wallets on Sepolia.

## Environment

Add these values to `.env.local` at the project root:

```dotenv
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=
```

Use a fresh test wallet and a `0x`-prefixed private key. Fund that wallet with Sepolia ETH for deployment gas. The key is server/tooling-only and must never use a `NEXT_PUBLIC_` prefix. Both `.env` and `.env.local` are ignored by Git.

Creator, advertiser and investor interactions use Privy-connected wallets. Set `NEXT_PUBLIC_PRIVY_APP_ID` and allow `APP_ORIGIN` in the Privy dashboard. The browser needs no Privy app secret. Privy handles external-wallet selection and optional email-created embedded wallets; viem submits through the selected Privy provider on Sepolia. Their keys do not belong in the server environment. The backend uses `PRIVATE_KEY` to issue participant authorizations after World verification, and a separate `PROOF_SIGNER_PRIVATE_KEY` for matched-photo releases. Both signers must match the deployed `AuctionHouse`.

## Privy origin setup

Use `http://127.0.0.1:3000` for this project's local server and add that exact origin in Privy Dashboard → Configuration → App settings → Domains. `http://localhost:3000` is a different browser origin even when it points to the same machine. A blocked `auth.privy.io` frame or session 403 means the current origin is not permitted; editing Next.js headers cannot change Privy's `frame-ancestors` policy. Keep existing allowed origins and add the local one. The wallet UI offers a retry after startup times out.

## World ID

Set `NEXT_PUBLIC_WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_SIGNING_KEY`, `WORLD_ENVIRONMENT` and `WORLD_ACTION` from your World Developer Portal configuration. This implementation uses IDKit 4.3.0, v4 requests and Proof of Human, with the documented legacy Orb fallback enabled. The default environment is `staging`; use the environment configured for your app and testing credential.

Create `WORLD_IDENTITY_SALT` as a random secret of at least 32 characters. It keeps the private uniqueness mapping separate from raw World nullifiers. Keep this value stable: changing it would invalidate the existing identity mapping.

The user signs a short-lived wallet challenge. The backend then signs an RP request bound to that wallet, checks the returned nonce, signal, credential, action and environment, and verifies the proof with World's official verification endpoint. One person maps to one wallet in the application/action scope. Only a validated result can issue an onchain participant voucher. The official Proof of Human preset includes a legacy Orb fallback; both are checked by World's v4 verification endpoint. Device and document fallback proofs are rejected. `expires_at_min` is a proof's disclosed lower bound, not the credential's expiry time. Request expiry, wallet signal, action and environment remain enforced. After backend verification, the wallet must confirm the authorization transaction before publishing unlocks. Cancelling, rejecting or lacking the credential leaves publishing and bidding unavailable. Investing and trading stay permissionless.

Successful human verification requires a person to complete the widget. A signed RP request and rejection tests alone are not evidence of a completed World verification.

## ENSv2 parent

`placed-demo.eth` is the registered testnet parent for this deployment. It is the namespace containing asset names such as `a1.placed-demo.eth` and slot names such as `s1.a1.placed-demo.eth`. Creators do not register a separate .eth name themselves.

Each asset has a child registry and metadata resolver; every slot gets its own Permissioned Resolver. The backend follows the ENSv2 ETH registry into this hierarchy, reads model/placement metadata and public artwork, and cross-checks the ENS revenue-token reference against the asset's registered financing series. The winner gets only the `ad.artwork` setter role on that slot's resolver. Completion or refund revokes that role.

## Deploy your own instance

The checked-in manifest describes the shared Sepolia deployment. To create your own instance, configure fresh backend signer keys and an available `ENS_PARENT_NAME`, install Foundry, then run:

```sh
npm run contracts:setup
npm run contracts:build
npm run contracts:abi
npm run contracts:deploy
```

The script registers the ENS parent using the official test registrar's test currency, deploys services, configures their bindings and writes `src/lib/marketplace/deployment.json`. It resumes from private state in `data/sepolia-setup.json`; keep that file local. One wallet funds deployment gas. Do not replace an active deployment with listed assets. `REPLACE_DEPLOYMENT=true` is a maintainer-only reset for an empty test deployment.

## Storage and AI

Set `APP_ORIGIN` to the application's canonical URL. Media URLs are included in immutable onchain records, so configure the origin before publishing. Uploaded PNG/JPEG/WebP and self-contained GLB files are content-addressed under `data/marketplace-media/`. SQLite stores wallet sessions, private identity mappings, generation ownership and proof results. Use persistent storage and a single Node server for this MVP.

`OPENAI_API_KEY` enables conservative logo/placement matching with `OPENAI_VISION_MODEL` (default `gpt-4.1-mini`). A matched result produces a short-lived EIP-712 signature bound to the campaign, immutable winning artwork, proof hash, chain and auction contract. Uncertainty and service failures leave escrow held. This authorization can release funds once; refunds and releases cannot both succeed.

`TRIPO_API_KEY` plus `GENERATION_ENABLED=true` enables the marketplace's one-image outfit route. Requests require a wallet session and are limited to two per wallet and ten total per hour. The standalone studio's existing image generation and saved-model routes remain local-only.

## Protocol references

Read the deployed revisions rather than assuming an upstream default branch matches the deployment:

| Integration                 | Reference revision                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ENSv2 Sepolia               | [`contracts-v2`, `71a3b73`](https://github.com/ensdomains/contracts-v2/tree/71a3b7339dbc55ab47667abdfe8303bac4f4c24e)                            |
| Uniswap CCA v2.1.0          | [`continuous-clearing-auction`, `7d7602d`](https://github.com/Uniswap/continuous-clearing-auction/tree/7d7602d257733315434570f2a0c2f94f1c7b207a) |
| Uniswap LBP strategy v3.3.0 | [`liquidity-launcher`, `1c59049`](https://github.com/Uniswap/liquidity-launcher/tree/1c5904912aefceaceb89c24528cd5e25d0b61597)                   |

Our Sepolia fork tests validate these revisions against the deployed contracts. Addresses are documented in the [ENSv2 deployment artifacts](https://github.com/ensdomains/contracts-v2/blob/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/docs/addresses/sepolia.md) and [Uniswap deployment list](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments).

Local documentation and upstream repository clones live in ignored `reference/`. They are excluded from application formatting, type checking and output tracing. Dependencies needed by our contracts will be pinned separately in the contract workspace.

The MVP does not use Privy or additional chains. Wallet connections use EIP-6963 discovery with an injected-provider fallback. No World agent flow or custom swap hook is required.
