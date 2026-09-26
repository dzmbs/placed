import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  ChevronDown,
  Globe2,
  ScanLine,
  ShieldCheck,
  SquareDashedMousePointer,
  BarChart3,
  Layers3,
  Wallet,
} from 'lucide-react';
import { sales, type SaleEvidence } from '@/lib/why-evidence';
import { EvidenceCarousel } from '@/components/evidence-carousel';
import { MarketNav } from '@/components/market-ui';
import '@/app/why/why.css';

export const metadata: Metadata = {
  title: 'Placed | Advertising on physical and digital spaces',
  description: 'How creators list ad space and brands book campaigns on Placed.',
};

function SourceLinks({ sale }: { sale: SaleEvidence }) {
  return (
    <div className="why-source-links">
      {sale.website && (
        <a href={sale.website} target="_blank" rel="noreferrer">
          Campaign <ArrowUpRight size={12} />
        </a>
      )}
      {sale.post && (
        <a href={sale.post} target="_blank" rel="noreferrer">
          Original post <ArrowUpRight size={12} />
        </a>
      )}
      {sale.result && (
        <a href={sale.result} target="_blank" rel="noreferrer">
          {sale.resultLabel ?? 'Result'} <ArrowUpRight size={12} />
        </a>
      )}
      {sale.screenshot && (
        <a href={sale.screenshot} target="_blank" rel="noreferrer">
          Source screenshot <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  );
}

function Screenshot({ sale, featured = false }: { sale: SaleEvidence; featured?: boolean }) {
  const supplied = featured && !!sale.featuredImage;
  const src = supplied ? sale.featuredImage : sale.screenshot;
  if (!src) return null;
  return (
    <a
      className={`why-screenshot why-screenshot-${sale.id}${supplied ? ' why-campaign-image' : ''}`}
      href={src}
      target="_blank"
      rel="noreferrer"
      aria-label={`Enlarge ${sale.creator} ${supplied ? 'campaign image' : 'evidence screenshot'}`}
    >
      <img
        src={src}
        alt={
          supplied
            ? sale.featuredImageAlt
            : `${sale.creator}: source screenshot supporting ${sale.amount}. ${sale.basis}.`
        }
        loading="lazy"
      />
      <span>
        {supplied ? 'View image' : 'View capture'} <ArrowUpRight size={13} />
      </span>
    </a>
  );
}

const featuredCases = [
  { id: 'bonnie', category: 'NAMING RIGHTS' },
  { id: 'marc', category: 'PHYSICAL' },
  { id: 'solana', category: 'DIGITAL' },
  { id: 'vanshika', category: 'CLOTHING' },
  { id: 'riri', category: 'CLOTHING' },
].flatMap(({ id, category }) => {
  const sale = sales.find((item) => item.id === id);
  return sale ? [{ sale, category }] : [];
});

const steps = [
  {
    icon: Box,
    title: 'Choose your space',
    description: 'Choose a 3D model or import your own to show brands where their ad will appear.',
  },
  {
    icon: SquareDashedMousePointer,
    title: 'Set the campaign',
    description: 'Mark ad placements, name your slots and choose display dates.',
  },
  {
    icon: Wallet,
    title: 'Accept bids',
    description:
      'Brands bid in USDC. The highest funded bid wins; outbid brands can withdraw their funds.',
  },
  {
    icon: ScanLine,
    title: 'Submit proof',
    description:
      'Display the winning artwork and submit a photo. Approved proof releases the remaining payment.',
  },
];

export default function WhyPage() {
  return (
    <div className="mp-app why-app">
      <MarketNav />

      <main>
        <header className="why-hero">
          <div className="why-kicker">A MARKETPLACE FOR YOUR WORLD</div>
          <h1>
            Ad space, from outfits
            <br />
            <span>to billboards.</span>
          </h1>
          <div className="why-hero-bottom">
            <p>
              List physical or digital ad space. Brands choose a placement, bid on a campaign and
              upload their artwork.
            </p>
            <div className="why-hero-actions">
              <Link className="why-button" href="/explore">
                Explore ad space <ArrowRight size={17} />
              </Link>
              <a className="why-secondary-link" href="#how-it-works">
                See how it works
              </a>
            </div>
          </div>
        </header>

        <nav className="why-chapters" aria-label="Page sections">
          <a href="#evidence">
            <BarChart3 size={17} />
            <span>01</span> The evidence
          </a>
          <a href="#how-it-works">
            <Layers3 size={17} />
            <span>02</span> The product
          </a>
          <a href="#onchain">
            <Globe2 size={17} />
            <span>03</span> Why onchain
          </a>
        </nav>

        <section className="why-section" id="evidence" aria-labelledby="evidence-title">
          <div className="why-section-heading">
            <div>
              <div className="why-kicker">01 / EXAMPLES</div>
              <h2 id="evidence-title">Campaigns that show the demand.</h2>
            </div>
          </div>
          <EvidenceCarousel count={featuredCases.length}>
            {featuredCases.map(({ sale, category }, index) => (
              <article
                className="why-evidence-card"
                key={sale.id}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${featuredCases.length}: ${sale.creator}`}
              >
                <Screenshot sale={sale} featured />
                <div className="why-card-top">
                  <span>CASE / 0{index + 1}</span>
                  <span>{category}</span>
                </div>
                <div className="why-amount">{sale.amount}</div>
                <div className="why-timing">{sale.timing}</div>
                <h3>{sale.creator}</h3>
                <p className="why-surface">{sale.surface}</p>
                <div className="why-card-bottom">
                  <span className="why-basis">{sale.basis}</span>
                  {sale.featuredNote && <p className="why-featured-note">{sale.featuredNote}</p>}
                  <SourceLinks sale={sale} />
                </div>
              </article>
            ))}
          </EvidenceCarousel>
          <p className="why-evidence-caption">
            Independent campaigns, checked 27 Sep 2026. Amounts include reported payments,
            commitments and bids; they are not typical earnings or Placed transactions.
          </p>

          <details className="why-research" id="all-campaigns">
            <summary>
              <span>
                <strong>All {sales.length} campaigns and sources</strong>
              </span>
              <ChevronDown size={19} />
            </summary>
            <div className="why-research-intro">
              Timelines refer to sales, not ad display periods. Unknown durations are marked.
              Amounts use their original currencies.
            </div>
            <div
              className="why-table-scroll"
              role="region"
              aria-label="Campaign evidence table"
              tabIndex={0}
            >
              <table className="why-table">
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col">Amount & basis</th>
                    <th scope="col">Timeline</th>
                    <th scope="col">Source notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <th scope="row">
                        <strong>{sale.creator}</strong>
                        <span>{sale.surface}</span>
                        <SourceLinks sale={sale} />
                      </th>
                      <td>
                        <strong className="why-table-amount">{sale.amount}</strong>
                        <span>{sale.basis}</span>
                      </td>
                      <td>
                        <strong>{sale.timing}</strong>
                        <span>{sale.timingNote}</span>
                      </td>
                      <td>{sale.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="why-section" id="how-it-works" aria-labelledby="product-title">
          <div className="why-section-heading">
            <div>
              <div className="why-kicker">02 / THE PRODUCT</div>
              <h2 id="product-title">How a campaign works</h2>
            </div>
          </div>
          <div className="why-steps">
            {steps.map((step, index) => (
              <article key={step.title}>
                <div className="why-step-head">
                  <step.icon size={23} strokeWidth={1.5} />
                  <span>0{index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
          <p className="why-product-note">
            Each placement can host its own brand. Run another campaign after the previous one
            settles.
          </p>
        </section>

        <section className="why-section why-onchain" id="onchain" aria-labelledby="onchain-title">
          <div className="why-section-heading">
            <div>
              <div className="why-kicker">03 / PAYMENTS AND OWNERSHIP</div>
              <h2 id="onchain-title">How bids and payments are handled</h2>
            </div>
          </div>
          <div className="why-protocols">
            <article>
              <ShieldCheck size={21} />
              <h3>World</h3>
              <p>Verify you are human before publishing or bidding.</p>
            </article>
            <article>
              <Globe2 size={21} />
              <h3>ENS</h3>
              <p>
                Each asset and placement has a name. The winning brand controls its campaign
                artwork.
              </p>
            </article>
            <article>
              <Wallet size={21} />
              <h3>USDC escrow</h3>
              <p>
                Outbid brands can withdraw their funds. Part of the winning payment stays in escrow
                until proof is approved or an administrator issues a refund.
              </p>
            </article>
          </div>
          <div className="why-financing">
            <div className="why-financing-copy">
              <span className="why-financing-tag">OPTIONAL FINANCING</span>
              <h3>Sell a share of future ad revenue.</h3>
              <p>
                Creators choose a percentage and a term. Token holders receive that share of
                eligible advertising receipts from the asset’s placements. Returns are not
                guaranteed.
              </p>
            </div>
            <ol className="why-financing-flow">
              <li>
                <span>01</span>
                <div>
                  <strong>Launch a token sale</strong>
                  <p>A continuous clearing auction sets the token price and allocation.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Trade on Uniswap v4</strong>
                  <p>Buy or sell revenue tokens after the sale.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Redeem revenue</strong>
                  <p>Redeem your share after the term ends and its campaigns settle.</p>
                </div>
              </li>
            </ol>
          </div>
          <div className="why-boundaries">
            <p>
              Photo verification checks artwork and placement, not continuous exposure. Refunds
              require an administrator’s review.
            </p>
          </div>
        </section>

        <div className="why-actions">
          <Link className="why-button" href="/explore">
            Explore ad space <ArrowRight size={18} />
          </Link>
          <Link className="why-secondary-link" href="/studio">
            List your asset <ArrowRight size={17} />
          </Link>
        </div>
      </main>
      <footer className="why-footer">
        <span>Placed</span>
        <a href="#evidence">
          Evidence checked 27 Sep 2026 <ArrowUpRight size={12} />
        </a>
      </footer>
    </div>
  );
}
