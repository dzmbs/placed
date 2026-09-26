# Placed and the structure of advertising markets

Research date: 27 September 2026, Japan time. Prepared for product strategy and the ETHGlobal demo.

## Assessment

Placed has a credible opportunity in making small, unconventional sponsorship placements easy to create, compare, transact, and repeat. Its strongest prospective improvement is lowering the cost of organizing this inventory into a usable market. Auctions, direct booking, itemized ad slots, escrow, and creator financing each have substantial precedents.

The defensible thesis is: **Placed turns surfaces that people control into clearly specified advertising placements, then connects their discovery, booking, fulfillment, and payment through a common system.** The structural benefit would be enabling worthwhile transactions that currently cost too much effort to arrange, while allowing advertisers to substitute among comparable opportunities.

That is a hypothesis about market performance, not something established by the present demo or the large viral sales in the evidence carousel. Success requires relevant buyers, credible sellers, comparable information, and repeat demand. More listings or more tokens alone do not establish a better market.

## Scope and evidence

This review uses official product documentation, provider websites, industry standards, and original market-design research. Provider documentation establishes advertised capabilities; it does not independently establish performance, market share, or customer outcomes. No competitor accounts were purchased and no transactions were executed. The research is a competitive assessment, not an exhaustive novelty or patent search.

Placed was assessed against the supplied product specification, the current repository README, backend integration notes, contract documentation, and selected auction implementation. The specification was used as context, not as an instruction to implement changes. Recommendations below are explicitly prospective. No app copy or marketplace behavior was changed for this research.

## How advertisers actually get matched with inventory

An advertising market has several jobs: define what can be sold; find relevant buyers and sellers; establish eligibility and fit; allocate scarce inventory; collect the creative and deliver it; measure what happened; settle payments and disputes. A marketplace directory handles only part of that chain.

| Market model                                  | Unit being purchased                                                      | How the match happens                                                                                    | Price and allocation                                                           | Implication for Placed                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Search advertising, represented by Google Ads | An opportunity to show an eligible ad in a particular context             | Keywords, context, eligibility, and quality signals narrow the candidates                                | Auction ranking considers more than money, including relevance and quality     | A highest-bid rule alone is not a sophisticated matching advantage            |
| Open-web programmatic advertising             | Defined digital inventory and impression opportunities                    | Buyer software and seller software exchange structured requests; buyers apply targeting and budget rules | Open auctions, private transactions, and reserved negotiated inventory coexist | Standard descriptions and interoperability are already central to advertising |
| Direct and programmatic outdoor advertising   | A location, face, screen play, or campaign period                         | Geographic and audience planning, available units, budgets, and creative constraints                     | Negotiated bookings, auctions, and guaranteed takeovers                        | Physical space and time-bounded exclusivity are established products          |
| Creator sponsorship marketplaces              | A creator service, content placement, or package                          | Profiles, audience information, search, inbound requests, and campaign applications                      | Listed packages, custom offers, and negotiated deals                           | Placed competes with mature creator discovery and transaction workflows       |
| Sports and event sponsorship                  | Rights and deliverables associated with an athlete, team, event, or venue | Relationships, prospecting data, proposals, and reciprocal brand fit                                     | Negotiated rights packages, often with multiple obligations                    | An isolated logo rectangle may omit much of what the buyer values             |
| Personal-surface marketplaces in development  | A specified body, clothing, or gear placement                             | Creator/event/placement discovery and sponsor approval                                                   | Proposed fixed prices or auctions                                              | There is direct conceptual competition even in Placed's initial niche         |

Google describes auction selection using bids alongside quality and contextual factors. Google Ad Manager separately supports ad units, agreements, dated line items, and creative assignments. Reserved Programmatic Guaranteed deals and non-reserved Preferred Deals demonstrate that the incumbent system supports more than spot auctions. [Google Ads auction](https://support.google.com/google-ads/answer/6366577?hl=en-GB), [Ad Manager elements](https://support.google.com/admanager/answer/6012282?hl=en), [Programmatic deal types](https://support.google.com/admanager/answer/7637485?hl=en).

The general programmatic path is advertiser → buying platform → exchange/selling platform → publisher inventory. Agencies, data providers, measurement vendors, and intermediaries may also participate; there is no single mandatory chain. OpenRTB provides a shared communication standard. Placed should learn from this interoperability rather than describe digital advertising as lacking common inventory machinery. [IAB Tech Lab OpenRTB](https://iabtechlab.com/standards/openrtb/).

## Closest competitive reference points

### AdQuick: physical inventory already has a common buying workflow

AdQuick advertises discovery and booking across outdoor formats and media owners. Its supplier product tracks availability, holds, contracts, conflict checks, and proof of posting. This directly rebuts a claim that existing physical advertising has no shared marketplace or connected delivery process. Placed's possible advantage is making that kind of infrastructure practical for smaller, less conventional sellers, with substantially easier inventory creation. [Buyer marketplace](https://www.adquick.com/marketplace), [Supplier operations](https://www.adquick.com/media-owners).

### Vistar and Blip: outdoor auctions and small purchases already exist

Vistar supports open exchange transactions, private marketplaces, and guaranteed negotiated deals, including takeovers. Blip documents automated auctions for short billboard displays and pay-per-play purchasing. An outdoor auction or low purchase minimum is therefore insufficient differentiation. Placed's proposed unit is typically a specific placement for a campaign period, rather than a rotating screen play; that is a choice of product and market segment, not proof of superiority. [Vistar transaction models](https://www.vistarmedia.com/blog/understand-programmatic-dooh-transactions), [Blip operation](https://help.blipbillboards.com/how-does-blip-work).

### Passionfroot: the strongest reference for creator inventory organization

Passionfroot provides creator storefronts, audience information, rates, scheduling, and brand partnerships. Its documentation already distinguishes dated slots from placements within them, and supports packages and proposals. Placed could extend similar inventory discipline to visually specified physical surfaces. It cannot credibly claim that separating a creator from individual bookable placements is a new market concept. [Creator product](https://www.passionfroot.me/creators), [Slots, placements, and workflow](https://help.passionfroot.me/en/articles/11552873-faqs).

### Collabstr: transaction confidence is an existing marketplace feature

Collabstr combines creator discovery and audience information with packages, custom offers, and campaign applications. Its ordering workflow includes upfront funding, escrow, creator acceptance, content approval, and support-led disputes. This is a useful benchmark for Placed's purchase experience. Onchain accounting can change who enforces payment rules and who can inspect them, but holding payment until delivery is already available. [Marketplace capabilities](https://help.collabstr.com/en/article/what-is-collabstr-1bz1tdk/), [Ordering and settlement](https://help.collabstr.com/en/article/how-to-place-an-order-with-an-influencer-j0fgkl/).

### OpenSponsorship, SponsorUnited, and SponsorCX: different parts of the sponsorship process

OpenSponsorship connects athletes, teams, and events with brands through profiles, applications, and proposals. SponsorUnited supplies prospecting and pricing intelligence. SponsorCX manages sponsorship inventory, agreements, scheduling, fulfillment, and reporting. These are distinct product roles: discovery marketplace, intelligence system, and operating software. None should be reduced to an undifferentiated "middleman." [OpenSponsorship workflow](https://opensponsorship.com/about/athlete), [SponsorUnited](https://www.sponsorunited.com/), [SponsorCX](https://www.sponsorcx.com/property-product/).

### Sponsor My Body: a direct emerging competitor

Its public site proposes body, clothing, and gear placements, fixed prices or auctions, sponsor approval, previews, and proof before payment. At the research date it explicitly said bookings, bidding, and payments were not open; examples were illustrative. It is evidence of competitive intent, not evidence of an operating marketplace with traction. Placed would need to win on execution, supply, demand, and reuse across asset categories. The concept of organizing personal surfaces into sponsorship inventory is already shared. [Sponsor My Body](https://sponsormybody.com/).

### Spotter: financing future advertising income has precedent

Spotter offers upfront creator capital in exchange for a share of long-form YouTube advertising revenue under licensing arrangements. Placed's proposed asset-specific token and vault differ in implementation and scope, but financing creators against advertising income is not itself new. Funding and secondary token trading should be evaluated separately from advertiser-to-slot matching. [Spotter Capital](https://www.spotter.com/creator-capital).

## Where a structural improvement could come from

The following is analysis derived from the comparison, not a claim that incumbents lack every feature mentioned.

### 1. Make inventory creation cheap enough for small sellers

A person who can offer an event outfit or a livestream backdrop may lack a practical way to describe, price, schedule, and fulfill it as advertising inventory. A shared editor and transaction workflow could replace a custom site and repeated negotiation over basic details.

The economic test is whether the value of a prospective match exceeds its production, search, coordination, and risk costs. Lowering these costs can make previously uneconomical small transactions viable. Raising the clearing price is not required for the market to improve: sellers can earn more net income while advertisers spend less time buying.

Placed's image-to-model workflow and visual slot editor are a plausible contribution here. Require 3D only where it resolves meaningful ambiguity. A good annotated photograph may be sufficient for a flat surface; compulsory reconstruction could increase costs.

### 2. Standardize the agreement while preserving the differences buyers care about

The useful common unit is approximately:

**Controlled asset + exact placement + dates/event + promised exposure or activity + permitted creative + evidence requirements + payment/remedy rules.**

The geometry is only one field. A chest placement at a founder conference and the same-size placement on an unused shirt have very different value. Audience, context, visibility, and fulfillment credibility must remain visible.

The creator → asset → slot → campaign model is a good organizing choice. Its opportunity is broad usability and shared execution across unusual surfaces, rather than inventing the idea of ad inventory hierarchy. Google already documents parent and child ad units. [Ad-unit hierarchy](https://support.google.com/admanager/answer/177203?hl=en).

### 3. Bring enough relevant alternatives together to improve matching

A shared marketplace can help a buyer discover a useful placement outside the creator's existing social following. It can also give the creator access to buyers who would never see a standalone launch post. That would be a real improvement over each seller distributing a separate site.

However, inventory is not interchangeable merely because it has the same database fields. One million unrelated surfaces can be less useful than fifty relevant, available placements at the same event. Start with a concentrated buyer need and let buyers compare alternatives within it.

An illustrative buyer brief is: "Reach developers at this conference next week, within this budget, using approved apparel placements." Matching should filter availability, rights, audience/context, brand restrictions, production deadline, and proof quality before ranking eligible options by price and expected usefulness. A browse grid with auctions is only an initial discovery interface.

### 4. Turn completed transactions into reusable information

Persistent records can accumulate credible evidence of fulfillment, cancellations, settled prices, and repeat purchases. This could reduce the uncertainty surrounding a first-time transaction with a small seller and improve later pricing.

Keep the units of evidence separate: asking price, live bid, winning bid, funded payment, released proceeds, delivered placement, measured exposure, and commercial outcome. A paid bid does not prove attention. A photo of the logo does not prove the promised duration. A settled price does not automatically measure advertiser return.

Reputation should attach to the relevant creator and asset while preserving campaign detail. A seller's successful digital campaigns do not automatically establish physical fulfillment reliability.

### 5. Allow multiple services to use the same inventory and settlement records

Persistent identifiers and inspectable contracts could support other discovery sites, agency interfaces, verification services, and financing tools using the same asset records. In that architecture, a creator could benefit from several sources of demand without rebuilding the listing and payment system each time.

This becomes a structural benefit only when usable schemas, permissions, APIs/indexing, media access, and shared availability are available to other services. An ENS name and a blockchain transaction alone do not demonstrate that portability. Nor does an asset identifier prove permission to sell the physical placement.

The incumbent digital ecosystem already has interoperability and seller-transparency standards, including authorized-seller declarations and supply-chain records. Placed's opportunity is extending usable shared infrastructure into its chosen inventory segment. [IAB seller transparency](https://iabtechlab.com/sellers-json/).

## Choices that could weaken the market

| Design choice                                      | Failure mode                                                                           | Better direction to test                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Auction every slot                                 | Few relevant bidders, delay, price uncertainty, and repeated empty auctions            | Fixed-price booking and offers for ordinary inventory; timed auctions for genuinely contested placements |
| Allocate only by the highest payment               | Incompatible artwork or sponsor categories; creator reputational costs                 | Establish seller restrictions and creative eligibility before competitive allocation                     |
| Sell every rectangle separately                    | Buyers may need a package; competing logos can reduce each other's value               | Category exclusivity, bundles, total ad-load limits, and explicit compatibility rules                    |
| Treat all surfaces as one market                   | Buyers cannot compare relevance or execution requirements                              | Common underlying schema with category-specific discovery and fulfillment                                |
| Require every buyer to use unfamiliar crypto tools | Procurement and participation friction can outweigh payment advantages                 | Measure completion rates; design account, agency, and payment access for the target users                |
| Use one post-campaign photo as full proof          | Duration, audience, location, and continuous visibility remain uncertain               | Define evidence by category and separate placement verification from exposure measurement                |
| Depend on creators bringing all demand             | The product remains useful listing software but has limited marketplace matching value | Measure purchases initiated by marketplace discovery, including cross-creator repeat buying              |
| Finance assets before recurring demand exists      | Financial activity can obscure a weak advertising business                             | Prove fulfilled campaigns and renewals before emphasizing revenue financing                              |

The auction tradeoff is material: a rule can transparently allocate bids without finding the best match. For unusual sponsorships, mutual fit and contractual completeness often matter before price competition begins. Likewise, independently auctioning two adjacent slots can create a poor result if each buyer expects category exclusivity.

Auctions also commit buyer capital while participation is uncertain. Immediate outbid withdrawals help, but a brand seeking several substitute opportunities still faces decisions about how much to fund, where, and when. Buyer-side budgets and coordinated booking would become important at scale.

## What the blockchain components actually contribute

| Component                              | Plausible contribution                                                                       | What remains outside that contribution                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Funded bidding and contract accounting | Makes accepted funding, allocation, withdrawal credits, and released payment splits explicit | Does not establish a suitable buyer, surface rights, delivered exposure, or an optimal price                        |
| USDC settlement                        | A shared settlement denomination and programmable transfer path                              | Does not eliminate onboarding, conversion, operational, or procurement costs                                        |
| ENS asset and slot identities          | A reusable lookup and permission structure                                                   | Does not by itself create adopted interoperability or validate offchain ownership                                   |
| World participant verification         | A check supporting participant uniqueness within the configured scope                        | Does not establish brand authority, honest behavior, audience quality, or prevent collusion between distinct people |
| AI-assisted proof review               | Can help compare submitted artwork and placement evidence                                    | A reviewer still needs a policy; a photo cannot establish every campaign promise                                    |
| Asset revenue token and vault          | Can automatically route covered released receipts to a defined financial claim               | Does not create ad demand or capture off-platform receipts by itself                                                |

For the advertiser market, the most useful blockchain claim is narrower and more concrete than "trustless advertising": **the funding and settlement rules can be shared and inspected, while physical fulfillment still needs evidence and accountable dispute resolution.**

For financing, distinguish three markets: booking advertising, initially funding revenue rights, and trading those financial claims. Activity in the last two is not ad spend. Trading a revenue token does not transfer the right to display an ad, improve the original allocation of the slot, or guarantee an exit buyer.

## Current Placed implementation versus the strategic thesis

The repository now contains more than the studio described in the original Why page research. Its README and contract notes describe a Sepolia implementation for advertising auctions, naming, proof-related settlement, and asset financing, with a separate connected UI at `/marketplace`. The redesigned main UI still documents an unconnected adapter; `src/lib/market-client.ts` exports `null` at this research snapshot. These observations concern local code and documentation, not independently tested production behavior.

Selected auction code confirms a funded ascending-bid flow, outbid withdrawal credits, and sequential campaigns per slot. The reviewed path does not implement a general buyer-fit ranking, fixed-price checkout, package allocation, or a future multi-booking calendar. Those would be additional product capabilities, not descriptions of the present contract.

The escrow setting permits partial release at finalization. Only the held portion is available for the manual refund path. A claim of universally full buyer protection would therefore be inaccurate. The proof signer and refund administrator remain trust dependencies.

The contract notes explicitly distinguish fork tests from public transaction evidence and say several public participation, fulfillment, trading, and redemption demonstrations remain pending. The existence of deployed contracts should not be presented as established market liquidity or completed commercial adoption.

Local references: [README](../README.md), [backend integration](backend-integration.md), [contract evidence](contracts.md), [auction implementation](../contracts/src/AuctionHouse.sol), [UI adapter](../src/lib/market-client.ts). This was a strategic review, not a security audit or a fresh end-to-end test.

## Recommended initial market and validation

My recommendation is to begin with one event or recurring community where both sellers and advertisers already have a reason to participate. Conference apparel and gear is a coherent initial experiment given the existing demo evidence. Require a clearly defined event, deliverables, organizer/venue permissions where applicable, artwork deadlines, and buyer categories. Test recurring creator backdrops separately if the financing narrative needs durable inventory.

Alvin Roth's market-design framework emphasizes sufficient participation, the ability to evaluate and complete transactions without congestion, and safe, simple participation. Applied here, the priority is a dense relevant market with workable purchasing rules, not the largest number of heterogeneous listings. This application is our inference. [Roth, _What Have We Learned from Market Design?_](https://stanford.edu/~alroth/papers/2008_Hahn_Lecture_EJ.pdf).

An initial pilot should compare Placed with how the same type of sponsorship is presently arranged, including DMs and creator storefronts. Use comparable seller and buyer cohorts or a staged within-seller comparison; viral outliers are unsuitable controls. Record actual administrative time and all-in costs rather than assuming the marketplace saves money.

| Hypothesis                | What to measure                                                                   | What would weaken it                                                |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Easier inventory creation | Time to a complete, bookable listing; generation and support cost                 | More work than a photo and simple booking form                      |
| Better buyer discovery    | Qualified matches per brief; purchases from buyers the seller did not bring       | Almost every sale still depends on the creator's launch audience    |
| Better liquidity          | Relevant buyers per available slot; funded bids; sell-through by cohort           | Many listings with no serious interest or one bidder                |
| Lower transaction cost    | Buyer and seller handling time; total fees and support cost per fulfilled booking | Savings in checkout outweighed by proof disputes and manual service |
| Credible delivery         | Fulfilled campaigns, refund/dispute rates, time to settlement                     | Strong funding data but weak delivery confidence                    |
| Repeatable value          | Renewals and cross-creator repeat purchases without subsidies                     | One-off novelty spending that disappears after the launch           |
| Useful portability        | A second interface books or reads the same authoritative inventory successfully   | Names and metadata exist but only Placed can practically use them   |

Report medians and distributions, not only the biggest sale. Separate campaign value from creator proceeds, released versus held funds, financing proceeds, and secondary trading volume. Where exposure is measured, state the method and avoid treating it as proven incremental sales.

Potential defensibility would come from reliable access to relevant supply, buyer relationships, fulfillment history, comparable campaign data, and embedded repeat workflows. A rotatable model or an ERC-20 contract is comparatively reproducible. A shared standard can improve the ecosystem while making Placed itself more contestable, so the company still needs a service advantage.

## Implications for the ETHGlobal story

The evidence carousel demonstrates willingness to pay for unusual association and visibility. It does not establish typical seller earnings, repeat purchase rates, or a gap that every existing marketplace fails to address. The current evidence notes already qualify Bonnie Blue as an unverified naming-rights claim and Riri as an earlier snapshot. Keep those qualifications. A naming-rights publicity example also differs from a repeatable, time-limited ad placement and should not carry the entire market thesis.

The most useful demo sequence would show a surface becoming a clearly specified listing, a buyer comparing a relevant opportunity, a funded booking, and a transparent fulfillment/settlement state. If portability is claimed, demonstrate another consumer of the same record. If financing is shown, introduce it after the advertising transaction and identify the separate revenue rights.

Suggested spoken positioning:

> Advertising platforms have made standardized media easy to buy. Small, unconventional sponsorships still often need their own sales process. Placed gives those surfaces a common format: define the space, specify the campaign, let brands book it, and connect delivery evidence to payment. Our aim is to make useful sponsorships economical to transact and easy to repeat.

Suggested answer to "Why blockchain?":

> We use it for shared asset identities and explicit funding and settlement rules. Physical delivery still needs verification. Creators with recurring demand can separately choose to finance a defined share of future receipts.

Claims to avoid: first advertising marketplace; first physical ad auction; first creator escrow; first bookable slot model; first financing against creator ad revenue; automatic proof of attention; guaranteed price efficiency; guaranteed financial liquidity; or a quantified cost advantage that has not been measured.

## Research limits and follow-up questions

The highest-value next research is interviews and observed purchases, not additional generic market-size estimates. Ask buyers what makes a small sponsorship worth evaluating, what evidence they require, and whether they prefer fixed prices, offers, or auctions. Ask sellers about control of the surface, actual operating costs, category restrictions, and repeatability.

Public documentation cannot establish whether a provider would support every proposed Placed surface through custom workflows. Feature omissions from a website are not proof of impossibility. Several providers market APIs or operational integrations, so portability should be tested directly rather than assumed absent.

Passionfroot's public creator page and help FAQ showed different service-fee wording at the research date; no exact fee comparison is used here. Wrapify's homepage was discoverable in search but did not open reliably, and sticker.bid could not be substantively retrieved; neither is used to establish a central conclusion. ANA's transparency material describes important cost and media-quality issues, but its programmatic benchmarks should not be extrapolated into a claimed savings percentage for physical sponsorships. [ANA research overview](https://www.ana.net/content/show/id/media-programmatic-transparency).

The next proof Placed needs is a recurring set of relevant advertisers buying successfully fulfilled placements from creators they would otherwise have struggled to find or transact with, at a demonstrably lower total coordination cost.
