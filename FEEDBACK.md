# Integration feedback

## Uniswap CCA and v4

We use CCA for an asset's optional fixed-supply revenue-token launch, the official Liquidity Launchpad strategy for migration, and a v4 router for secondary trading. Advertising auctions and revenue accounting belong to our application contracts. We do not add a custom swap hook.

What worked: Sepolia exposes compatible CCA 2.1.0 and LBP 3.3.0 deployments. Fork tests completed two investor bids, exits, actual token claims, a funded creator-owned LP and a Universal Router swap. Another test recovered the complete budget when the fundraising threshold failed.

Friction: upstream default branches and deployment-compatible releases differ. CCA uses Permit2 funding, so a normal ERC-20 approval to the auction is insufficient. Auction steps use packed 24-bit distribution rates and 40-bit block spans. Partially filled bid exits need checkpoint hints. The v4 exact-input action requires a single dynamic tuple; flattening its fields produces invalid calldata.

Migration can be triggered directly on the official strategy, outside our coordinator. Our recovery path checks graduation, the consumed strategy pool reservation, currency sweep, expected pool key, creator ownership and actual LP liquidity before activation. A successful migration transaction alone is insufficient because the strategy can recover funds without creating a position.

Most valuable improvement: a versioned end-to-end Sepolia example covering Permit2, partial-exit hints, claims, fee-controller configuration, migration recovery and the exact router action encoding. Include both successful and failed fundraising paths.

Public sale/trade evidence is not recorded yet. The shared contracts and ENS parent are deployed; successful user verification and the public demo run remain to be completed. The feedback form submission is pending.

## World IDKit

The trust moment is creator publishing and the first funded advertising bid. Proof of Human is sufficient for participant uniqueness; we do not collect legal names or claim that it proves ownership of the asset. Investing and trading remain permissionless.

Implemented: IDKit 4.3.0 v4 requests, wallet-bound server-signed RP context, official server verification, private uniqueness mapping, onchain authorization and rejected/cancelled paths. Local HTTP checks confirmed request signing and rejection. Automated policy checks reject substituted wallets, actions, nonces, environments and credentials. Simulator testing exposed two integration errors: disabling Proof of Human's documented Orb fallback and treating `expires_at_min` as the credential expiry. Both are corrected, with v3 Orb and v4 human payloads forwarded unchanged to the official verifier. Device and document proofs remain rejected.

Time to first successful human proof is not measured yet. Do not count an RP signature or a mocked cryptographic response as a success. Finish this debrief after a person completes the widget in the configured environment.

Most valuable improvement: make the differences between v3 action proofs, v4 RP requests, staging credentials and production Proof of Human especially clear in a single migration example.

## ENSv2

Asset and slot discovery follows ENSv2's hierarchical registries. Dedicated slot resolvers isolate the winner's permission to `ad.artwork`. Asset token references are verified against the marketplace before enabling investment transactions.

Fork tests confirm that a winner can update only its slot artwork, other wallets and keys are rejected, and campaign completion revokes that permission. The testnet parent registration is live.

Most valuable improvement: prominently pair deployment artifacts with the matching source revision. Current resolver setters use DNS-encoded names while reads use namehashes; older examples can imply a different API.
