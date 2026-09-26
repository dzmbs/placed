# Integration feedback

## Uniswap CCA and v4

We use CCA for an asset's optional fixed-supply revenue-token launch, the official Liquidity Launchpad strategy for migration, and a v4 router for secondary trading. Advertising auctions and revenue accounting belong to our application contracts. We do not add a custom swap hook.

What worked: Sepolia exposes compatible CCA 2.1.0 and LBP 3.3.0 deployments. Fork tests completed two investor bids, exits, actual token claims, a funded creator-owned LP and a Universal Router swap. Another test recovered the complete budget when the fundraising threshold failed.

Friction: upstream default branches and deployment-compatible releases differ. CCA uses Permit2 funding, so a normal ERC-20 approval to the auction is insufficient. Auction steps use packed 24-bit distribution rates and 40-bit block spans. Partially filled bid exits need checkpoint hints. The v4 exact-input action requires a single dynamic tuple; flattening its fields produces invalid calldata.

Migration can be triggered directly on the official strategy, outside our coordinator. Our recovery path checks graduation, the consumed strategy pool reservation, currency sweep, expected pool key, creator ownership and actual LP liquidity before activation. A successful migration transaction alone is insufficient because the strategy can recover funds without creating a position.

Most valuable improvement: a versioned end-to-end Sepolia example covering Permit2, partial-exit hints, claims, fee-controller configuration, migration recovery and the exact router action encoding. Include both successful and failed fundraising paths.

On Sepolia the shared contracts and ENS parent are deployed and assets and slots are published from the live demo. One public token sale ran with a 30 block bidding window, got no bids during a period when our app was rate limited and correctly ended below its minimum raise. A successful public sale, trade and redemption are still pending.

A sale window measured in blocks was easy to get wrong. Thirty blocks sounds long and is about six minutes on Sepolia. Showing wall clock time next to block ranges in the docs and examples would help.

## World IDKit

**Trust moment.** Publishing an asset and placing a funded advertising bid. Both are where one person with many wallets can list fake assets or bid against themselves. Proof of Human is the minimum sufficient credential: we need uniqueness, not identity, so we never collect names or documents. It does not prove asset ownership and we do not claim it does. Investing and trading stay permissionless. Details are in [docs/world-id.md](docs/world-id.md).

**What we built.** IDKit 4.3.0 with v4 requests, a wallet-bound RP request signed on our server, result checks on nonce, action, environment, credential and wallet signal, the official v4 verifier, private one-person-one-wallet storage and an onchain participant voucher. Cancelled, unavailable, replayed and conflicting identities each get their own message and leave publishing and bidding locked. All verifications so far used the staging simulator, not production Proof of Human.

**Time to first success.** About 35 minutes from our first committed World integration to the first verified simulator proof. Work before that commit was not timed.

**Friction.**

- The production verifier needs a developer-opened 24 hour staging window and a server-only staging token for simulator proofs. Older guidance did not mention it. We found it through `environment_not_allowed` and the Portal source.
- We first disabled Proof of Human's documented Orb fallback and treated `expires_at_min` as the credential expiry. Both were our mistakes, but the docs made them easy to make.
- We reused one signed request per wallet to avoid rate limits. After a proof was produced for that nonce, a retry could fail. The docs do say to sign a fresh request each time, but the reason (`duplicate_nonce`) is only in the error code table.
- `onError` gives a code and a debug report. Our first version showed a generic message and threw both away, which made every failure look the same. Logging them was the single most useful debugging change.
- In staging, the simulator returned the same World ID 4.0 nullifier for every simulator identity we picked. With one-person-one-wallet storage only our first test wallet could ever verify, so every other tester got a conflict. We now scope staging identities to the wallet. Production stays strict.

**Missing capability or documentation.** A clear statement of how simulator identities map to v4 nullifiers, and a way to get a distinct test person per tester in staging. We could not tell whether our uniqueness logic was wrong or the simulator was.

**One improvement with the greatest impact.** A single end-to-end staging example that covers the staging token, fresh request signing on retry, `onError` codes with the debug report, and how to test one-person-one-wallet with several simulator identities.

## ENSv2

Asset and slot discovery follows ENSv2's hierarchical registries. Dedicated slot resolvers isolate the winner's permission to `ad.artwork`. Asset token references are verified against the marketplace before enabling investment transactions.

Fork tests confirm that a winner can update only its slot artwork, other wallets and keys are rejected, and campaign completion revokes that permission. The testnet parent registration is live.

Most valuable improvement: prominently pair deployment artifacts with the matching source revision. Current resolver setters use DNS-encoded names. Reads must go through `resolve` with the DNS-encoded name and an encoded profile query, rather than directly calling the old `text(bytes32,string)` getter. A Sepolia regression test covers metadata and artwork reads alongside scoped writes and revocation.
