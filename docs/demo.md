# Demo walkthrough

Use Ethereum Sepolia and test assets only. Start at `/`, browse assets at `/explore`, edit in `/studio` and manage your activity in `/portfolio`.

1. Open **Studio**, prepare the asset and choose **Publish asset**. Upload a well-lit outfit photo against a plain background. Generate it through Tripo, import a GLB, use your saved studio draft, or explicitly choose the prepared shirt example. Mark, move and resize rectangular slots. Connect a creator wallet and complete World verification. Publish the asset, then confirm each slot transaction.
2. Open the asset dashboard and create an advertising campaign. There is no financing requirement. Choose real bidding and display times, a bid increment and escrow percentage. Allow a minute for bidding to open.
3. Connect another World-verified wallet as the advertiser. In staging, select a different test identity in the [World simulator identity picker](https://simulator.worldcoin.org/select-id), then start a fresh verification from the advertiser wallet. Each test identity binds to one wallet; changing wallets alone does not create a new person. Get demo USDC, select a slot and preview a PNG/JPEG/WebP logo. Approve the USDC amount, then submit the funded bid. A second advertiser can outbid it; the first can withdraw the full previous bid.
4. After bidding closes, finalize it. The app displays the winning artwork resolved through the slot's ENSv2 resolver. The winner can change only that slot's `ad.artwork` record. Proof still targets the original winning artwork.
5. After the display period, the creator uploads a real photo. Match authorizes a release transaction; no match or uncertainty keeps escrow held. For a separate refund example, connect the admin and return the entire held balance. Zero-escrow campaigns need a completion transaction too. Both terminal paths revoke the winner's artwork permission.
6. For repeatable advertising, choose **Raise capital** on a separate asset or before creating future campaigns. Lock the fixed supply, revenue percentage and fixed term. The defaults allocate 60% to CCA, 20% to liquidity and the remainder to the creator. Set the term start far enough ahead for the sale and migration to finish.
7. Two investors submit different CCA budgets or maximum prices. ERC-20 approval and Permit2 spending authorization are separate transactions. After the sale ends, checkpoint the outcome, exit each bid to return unspent budget, then claim its tokens. A failed-threshold sale returns full budgets and never activates financing.
8. Migrate a successful launch into a funded v4 pool before the fixed term starts. Trade through the Invest panel using a fresh quote, separate spending approvals, a minimum received amount and a deadline. The initial LP belongs to the creator and is withdrawable.
9. Open covered campaigns across this asset's slots. Every released payment splits with the same asset vault. Add a future slot to show that no new token supply is created. Existing pre-activation campaigns keep their original payment terms.
10. After the fixed term and every covered campaign have settled, redeem tokens from Holdings. Transfers carry the accumulated and future revenue claim. Tokens in an LP must be removed before redemption.

Timing remains real. Public testnet transactions cannot be time-warped. Use short, clearly labeled demo terms and keep a completed launch available once an actual public run has been recorded. The automated fork tests cover delayed settlement and redemption without presenting them as public transactions.

## Before submission

- Record a successful World verification and a cancelled/rejected path with protected actions blocked.
- Capture public Sepolia evidence for CCA bids, exits, claims, migration, a secondary swap, advertising settlement, ENS updates/revocation and redemption.
- Deploy the app with persistent media storage and the correct public `APP_ORIGIN`.
- Complete [Uniswap's developer feedback form](https://developers.uniswap.org/hackathon-feedback), linking to `FEEDBACK.md` in the public repository. The form has not been submitted by this implementation.
