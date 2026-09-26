# Marketplace integration

The marketplace UI uses `MarketClient` in `src/lib/market-client.ts`. Supply the engineer's implementation there, or pass it to `MarketProvider`. The default is `null`: no wallet, listings, funds, verification results or receipts are fabricated. Without an adapter, the marketplace shows an unavailable state; Studio remains usable.

## Adapter contract

- `getState()` returns authenticated, authoritative `MarketState`. Public listings work with `current: null`. Return an empty assets array for a genuinely empty marketplace; reject on a service error.
- `connect()`, `disconnect()`, `switchNetwork()` and `verify()` integrate the actual wallet and identity providers and return updated state. Mark network as `supported` only after checking the configured chain. Set `networkName` from that chain. Never accept a client-provided admin role or verification result.
- `execute(action, accountId)` validates the signed-in account, chain, permissions and action against the server/contracts, requests required wallet signatures and resolves only after confirmation. Return `{state, message}`. Reject wallet cancellation, reverted transactions and validation errors. Implement idempotency/reconciliation so a network timeout cannot duplicate an action. Approvals must use verified spender addresses and chain token addresses; the UI's scope strings are identifiers, not addresses. Handle ERC-20 sell allowances in the swap implementation as well as USDC approval actions.
- `quoteSwap(request)` returns a server/router quote: `{id, received, minimum, fee, impact, expires}`. Bind its ID to the account, asset, side, amount and slippage; revalidate all of them at execution. No local pool formula remains. `impact` is a percentage; `expires` is an epoch timestamp in milliseconds. `fee` uses the input currency.
- `subscribe(onChange)` is optional. Notify on wallet/account/chain or indexed transaction changes. The UI also refreshes on focus and every 30 seconds while visible.

All dates are epoch milliseconds. Percentages in records/actions use basis points, except `SwapQuote.impact`. UI amount integers use six-decimal fixed-point units and must stay within `Number.MAX_SAFE_INTEGER`; convert raw token amounts using their actual on-chain decimals with integer arithmetic. Reject unrepresentable values rather than rounding or overflowing. The adapter must not assume creator tokens have six on-chain decimals.

## Data and action requirements

- Populate campaign `startingBid` from its actual auction configuration. Bids must validate amount, allowance, deadlines, ownership and the current minimum on the backend.
- Return confirmed ENS names only; use an empty string when none exists.
- Upload artwork/proof data to persistent storage before submitting transactions. Media inputs currently provide an image data URL, file name and SHA-256 digest. Verify MIME, size and digest server-side; never send an image data URL as calldata. Only authorized viewers should receive private bid artwork.
- Proof submissions contain no chosen result. The verifier sets `proofResult` to `pending`, `match` or `inconclusive`; refunds require backend authorization.
- Return actual financing allocations, fees, sale results, balances, claim eligibility and revenue totals. Token-sale creation and activation must present the backend's fees, allocations and immutable terms before the wallet signature. The UI no longer assumes a 60/20/20 allocation or a fixed protocol fee.
- Enforce redemption eligibility, token burning, claim uniqueness, auction settlement and escrow release/refund in the backend/contracts. Frontend button visibility is not authorization.
- Return only the account data and receipts the current session is entitled to see. No real balances or session credentials belong in localStorage.

The Studio-to-publish handoff continues to read `placed-market-pending-v1`; this is a draft, not a registered listing. Studio editing, draft storage and model-generation endpoints were outside this audit and were left intact.

## Merge checks

Verify account/chain changes during reviews, rejected signatures, failed confirmations, expiring quotes during approval, upload failures, outbid withdrawals, proof review, refunds and redemption against the real services. Inspect mobile bidding and trading, historical booking links, and the empty/unavailable states. Run `npm run check` before merge.

There are no marketplace API routes or wallet SDKs in this checkout yet. Existing `/api/assets`, `/api/models`, `/api/humans`, `/api/config` and `/api/generations` routes belong to Studio and must not be mistaken for marketplace endpoints.
