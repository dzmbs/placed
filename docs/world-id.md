# World ID in Placed

## The trust moment

Placed is a marketplace where creators list physical ad space (a shirt, a bag, a stream) and brands bid real USDC for it. Two events need to know something about the person first:

1. **Publishing an asset.** A creator is about to open funded auctions against their name.
2. **Placing a funded advertising bid.** A brand is about to lock money into escrow and compete with other sponsors.

Without a check, one person can run many wallets. They can list fake assets, bid against themselves to push prices up, or flood a slot with shill bids. The question at those two moments is not "who is this" but "is this one real person acting once". That is what Proof of Human answers.

## Why Proof of Human is the minimum sufficient credential

- **We need uniqueness, not identity.** We never need a legal name, age or nationality to run an ad auction. Passport or document credentials would collect more than the product needs.
- **Selfie Check is a lighter assurance than the risk.** It is a medium-assurance liveness credential with a risk score. Bids lock real funds and creators receive escrowed payouts, so we want the Orb-backed uniqueness of Proof of Human.
- **Proof of Human does not prove asset ownership.** We say so in the product. Ownership is backed by the proof photo and escrow flow, not by World ID.
- **Only the two risky actions are gated.** Browsing, investing in revenue tokens and trading stay permissionless. Investors do not need World verification.

We use the `proofOfHuman` preset with the documented legacy Orb fallback. Device and document fallback proofs are rejected.

## How it works

| Step | What happens                                                               | Code                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | The wallet signs a short-lived session challenge                           | [auth.ts](../src/lib/marketplace/server/auth.ts)                                                                                                      |
| 2    | The server signs an RP request bound to that wallet                        | [world.ts:48](../src/lib/marketplace/server/world.ts#L48), [signRequest at world.ts:68](../src/lib/marketplace/server/world.ts#L68)                   |
| 3    | The IDKit widget opens with the signed request                             | [context.tsx:287](../src/components/marketplace/context.tsx#L287)                                                                                     |
| 4    | The server checks nonce, action, environment, credential and wallet signal | [world-policy.ts:12](../src/lib/marketplace/world-policy.ts#L12)                                                                                      |
| 5    | The unchanged proof goes to World's official v4 verifier                   | [world-verifier.ts:30](../src/lib/marketplace/world-verifier.ts#L30)                                                                                  |
| 6    | The nullifier is stored as a private identity, one wallet per person       | [world.ts:196](../src/lib/marketplace/server/world.ts#L196), [conflict check at world.ts:292](../src/lib/marketplace/server/world.ts#L292)            |
| 7    | The server signs an EIP-712 participant voucher                            | [world.ts:262](../src/lib/marketplace/server/world.ts#L262)                                                                                           |
| 8    | The wallet submits the voucher onchain                                     | [AuctionHouse.sol:136](../contracts/src/AuctionHouse.sol#L136)                                                                                        |
| 9    | Publishing and bidding require that onchain authorization                  | [publishAsset at AuctionHouse.sol:146](../contracts/src/AuctionHouse.sol#L146), [bid at AuctionHouse.sol:197](../contracts/src/AuctionHouse.sol#L197) |

A proof that fails for any reason retires its signed request, so a retry always gets a fresh nonce ([world.ts:151](../src/lib/marketplace/server/world.ts#L151), [world-request-store.ts:82](../src/lib/marketplace/world-request-store.ts#L82)).

## Success and alternative paths

- **Success.** The proof verifies, the voucher is confirmed onchain and the wallet can publish and bid.
- **Cancelled.** The user closes the widget or rejects in World. Publishing and bidding stay locked and nothing is submitted ([context.tsx:374](../src/components/marketplace/context.tsx#L374)).
- **Credential unavailable.** The identity has no Proof of Human credential. The app explains that a verified identity is needed.
- **Identity already used.** In production, a World ID that already verified another wallet gets `409` and the wallet stays locked. This is the Sybil check doing its job.
- **Not ready yet.** `inclusion_proof_pending` asks the user to wait and try again.
- **Replay or expiry.** `nullifier_replayed`, `duplicate_nonce` and expired signatures each get a specific message and a fresh request.

Every IDKit error code is logged with its debug report, so a failed verification can be traced from the browser console and the server log.

## Staging note

In staging the World simulator returned the same World ID 4.0 nullifier for every simulator identity we picked. With strict one-person-one-wallet storage, only our first test wallet could ever verify. In `staging` only, the stored identity is scoped to the wallet so several testers can verify ([world.ts:195](../src/lib/marketplace/server/world.ts#L195)). The proof is still verified by World and still bound to the wallet. `production` keeps the strict rule: one person, one participant wallet.

See [integration setup](integrations.md#world-id) for environment variables and the staging token, and [FEEDBACK.md](../FEEDBACK.md#world-idkit) for our integration debrief.
