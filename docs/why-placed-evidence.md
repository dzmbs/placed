# Why Placed? — research notes

Checked 27 September 2026 for the ETHGlobal demo. The page is `/why`; its source data is `src/lib/why-evidence.ts`.

The supplied physical-ad-marketplace spec was treated as product context, not as an instruction to implement contracts or execute payments. This repository currently implements a local visual studio. The page labels auctions, escrow, World, ENS, and asset financing as planned. No contracts or payments were added.

## Method

Opened all nine supplied X posts in the browser and followed the actual campaign links. Checked the live pages after their client data loaded. X post times in the browser use Asia/Tokyo; the Winny, Fabiano, and Riri launch dates in the ledger use UTC. Retained original currencies and did not aggregate incomparable bids, commitments, and reported payments.

The exact links and per-campaign qualifications are maintained in `src/lib/why-evidence.ts`. Every row links to its sale page where one was established, its original post, and supporting result or timeline where needed. No separate sale website was established for the forehead example; its original post and reporting are linked instead.

| Campaign                             | Amount retained                          | Time interpretation                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solana / Mallow                      | $166,946.50 on the final auction site    | 24-hour advertised window, 1–2 Sep, plus per-zone anti-sniping extensions. Nine final bids sum to the displayed result. Donation transaction links are published on the site; no separate full audit was performed.        |
| Marc Lou                             | $112,000, creator says paid              | 8 Sep launch to 11 Sep 00:00 UTC close, about 58 hours; commonly described as three calendar days. Race date 19 Sep is not the sale duration. Original post says ten muscles, final campaign fifteen zones.                |
| Vanshika                             | $9,200, creator and loaded website agree | Sold-out post 14 Sep explicitly says less than 48 hours following the 12 Sep launch.                                                                                                                                       |
| Vincent / VynseDev                   | €7,955 site-reported raised              | Original auction advertised 14 days, but visible bid history spans 26 Aug–23 Sep. Do not pair the latest total with an unsupported 14-day result. Winners were contacted for payment according to the site.                |
| Winny                                | $5,750 committed; 22/22 sold on site     | Launch 26 Aug UTC; index first records this total 17 Sep, within 22 days. This is an upper-bound observation, not an exact sell-out timestamp.                                                                             |
| Riri                                 | $3,250 from the index’s 21 Sep snapshot  | Four days after the 17 Sep UTC launch. The loaded live site now shows 7/13 claimed and no total. The index contains stale contradictory explanatory text; the amount is an earlier unverified snapshot, not a final raise. |
| Vana / coinempress                   | $2,500 committed                         | Checked 27 Sep, 20 days after launch. Site says 13 sold, one held, four available; $175 held is not included. Current site deadline 29 Sep differs from an earlier social post saying Sunday.                              |
| Fabiano                              | $1,650 in leading bids                   | Three-day advertised window; 29 Aug UTC launch and 1 Sep stated close. Thirty days is the display period. A 20% deposit requirement does not establish full collection.                                                    |
| Wilfred / Will Baron, shared by Nate | No verified amount                       | Asking prices $300–$600 per spot per week and MrBeast interest were reported. No established completed sale or fundraising duration.                                                                                       |
| Bonnie Blue                          | £1.2m claimed winning bid for “BetBolt”  | Result announced 22 Sep, covered 23 Sep. No reliable opening time or independently confirmed payment found. Adjacent naming-rights example. The original site now serves a promotional graphic, not a results ledger.      |

## Screenshots

Stored in `public/evidence/`; the following are genuine browser captures, not recreated mockups. No source text was changed. The X result and article headline were captured with a viewport crop for legibility. The other captures show the campaign pages. Click a screenshot on `/why` to open its full saved capture. Source links are adjacent.

| File                          | Source                                                                      |
| ----------------------------- | --------------------------------------------------------------------------- |
| `solana-nepal.png`            | <https://nepal.mallow.art/>                                                 |
| `marc-hyrox.png`              | <https://hyrox.marclou.com/>                                                |
| `vanshika-result.png`         | <https://x.com/vanshuETH/status/2099413220641669280>                        |
| `brand-my-mac.png`            | <https://brandmymac.com/> with original euro display selected               |
| `bonnie-reported-auction.png` | <https://www.ibtimes.co.uk/bonnie-blue-baby-naming-auction-betbolt-1821405> |

Initial HTML from Vanshika and Riri shows zero sales before client data loads. This is not evidence of a zero raise. Wait for the loaded page when checking these sources. The saved screenshots and static evidence data make the demo independent of live embeds or social login availability.

## Featured campaign images

The five-card carousel features Bonnie Blue, Marc Lou, Solana, Vanshika, and Riri, in that order. The following images were supplied by the user on 27 September 2026 and copied without modification. They illustrate each campaign; the adjacent source links and original result captures establish the amount and its qualifications. The Bonnie and Riri cards retain their unverified-claim / earlier-snapshot labels.

| File                      | User-supplied image                                       |
| ------------------------- | --------------------------------------------------------- |
| `marc-hyrox-supplied.png` | Marc’s HYROX page with the blue stage and sponsor tattoos |
| `vanshika-dress.png`      | Front and back dress placements and asking prices         |
| `bonnie-blue.png`         | Bonnie Blue maternity and newborn photo collage           |
| `riri-outfit.png`         | Front and back numbered outfit placements                 |
