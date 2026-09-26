# Marketplace integration

`SepoliaProvider` connects the redesigned UI to Privy, World verification and the Sepolia contracts through `createMarketAdapter`. Public browsing works without a wallet. `/` is the landing page, `/explore` lists assets, `/studio` prepares drafts, and `/portfolio` manages listings, bookings and investments. Older `/marketplace` routes redirect to these views.

## Data

`/api/marketplace/state` reads assets, slot metadata, campaigns, settlement events, CCA status and wallet balances from the deployed contracts and ENSv2. No accounts, balances, bids or verification results are fabricated. Private proof photos additionally require a signed server session. Admins choose **Load proof photos** to authenticate.

Dates use milliseconds in the UI and seconds in contracts. Percentages use basis points. Display amounts use six decimal places; eighteen-decimal token balances are floored for display. Execution retains full raw quote amounts and redeems the actual token balance, including dust. Safe integer limits are checked before displaying amounts.

An asset may have multiple slots. Campaigns retain their own snapshotted financing terms. One optional asset financing series covers eligible future campaigns across its slots. Redemption uses the vault's aggregate unresolved-campaign gate. Listing an asset never creates a token.

## Transactions

The adapter checks the active account and Sepolia chain before signing. Contract calls are simulated, submitted through the selected Privy wallet, and awaited through Viem receipt tracking. Reverted receipts and wallet cancellation fail explicitly. Replacement tracking follows sped-up transactions and rejects cancelled or replaced operations.

The UI displays preparation, wallet approval, network confirmation and state refresh. Submitted transactions have Etherscan links. A timed-out contract call retains its hash so retrying the same operation waits for the existing transaction. Completed actions retain a reconciliation marker if the subsequent state read fails. Multi-transaction publishing and CCA claiming resume from confirmed metadata and contract state. This tracking is in memory; after a reload, inspect onchain state before repeating an operation.

USDC approvals target the deployed AuctionHouse or Permit2 and the registered CCA/router spender. Swap quotes are bound to the account, asset, side, amount and slippage. Expiry is checked again after approvals. The router receives the original minimum output and deadline.

Artwork uploads validate format, size and the selected bytes before persistence. The backend derives the stored artwork hash. Only the auction winner's confirmed ENS artwork updates the public preview. Token holders gain no artwork authority. Proof outcomes come from the backend verifier; only a valid campaign-bound authorization releases escrow.

CCA defaults are 60% sale, 20% liquidity and 20% retained supply, with up to 20% of net sale currency committed to liquidity. Fees and actual migration allocations come from the deployed launch configuration and events. Creator proceeds are transferred during migration; there is no separate collection action.

## Checks

Run `npm run check` and `npm run verify:marketplace`. Contract fork tests cover the official Sepolia ENSv2 and Uniswap deployments without broadcasting. A full public demo still needs signed CCA, trading and advertising transactions. See [setup](integrations.md) and [demo steps](demo.md).
