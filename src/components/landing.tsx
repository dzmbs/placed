import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Clock3 as ClockIcon,
  ArrowUpRight,
  Box,
  ChevronDown,
  Globe2,
  ScanLine,
  ShieldCheck,
  SquareDashedMousePointer,
  Wallet,
  ChartNoAxesCombined,
  Columns3,
  Workflow,
  Repeat2,
  Sparkles,
  Megaphone,
  Coins,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';
import { sales, type SaleEvidence } from '@/lib/why-evidence';
import { EvidenceCarousel } from '@/components/evidence-carousel';
import HeroShowcase from './hero-showcase';
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
      {sale.exchangeRateSource && (
        <a href={sale.exchangeRateSource} target="_blank" rel="noreferrer">
          Exchange rate <ArrowUpRight size={12} />
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
    title: 'List your space',
    description: 'Upload photos of a space you control. Choose a 3D model or import your own.',
  },
  {
    icon: SquareDashedMousePointer,
    title: 'Set the campaign',
    description: 'Define ad slots on your 3D model, set display dates and open your auction.',
  },
  {
    icon: Wallet,
    title: 'Accept bids',
    description:
      'Brands discover your space, preview their artwork in 3D and bid in USDC. The highest funded bid wins.',
  },
  {
    icon: ScanLine,
    title: 'Submit proof',
    description:
      'Display the winning artwork and upload a photo for AI image verification. Approved proof releases the remaining payment.',
  },
];

const paymentFeatures = [
  {
    icon: ShieldCheck,
    title: 'Verified participants',
    description:
      'World verifies that space owners and advertisers are human before they publish or bid.',
  },
  {
    icon: Globe2,
    title: 'Named spaces',
    description:
      'ENS gives each asset and placement a name. Winning brands control their campaign artwork.',
  },
  {
    icon: Wallet,
    title: 'Protected payments',
    description:
      'Part of the winning bid stays in USDC escrow until proof is approved. Outbid brands can withdraw their funds.',
  },
];

const financingSteps = [
  {
    icon: ChartNoAxesCombined,
    title: 'Launch a token sale',
    description:
      'Choose a revenue share and term. A Uniswap continuous clearing auction sets the token price and allocation.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trade revenue shares',
    description:
      'Investors can buy and sell revenue-share tokens on Uniswap v4 after the initial sale.',
  },
  {
    icon: Coins,
    title: 'Share campaign income',
    description:
      'Advertising receipts are split between the owner and token holders. Investors redeem after the term ends and campaigns settle.',
  },
];

const valueProps = [
  {
    icon: Globe2,
    title: 'Global discovery',
    description: 'Connect space owners with brands beyond their existing networks.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Price discovery',
    description: 'Open auctions help owners discover what advertisers will pay.',
  },
  {
    icon: Columns3,
    title: 'Easy comparison',
    description: 'Shared listings make placements, prices and campaign terms easier to compare.',
  },
  {
    icon: Workflow,
    title: 'Simpler campaigns',
    description: 'Connect booking, artwork, delivery evidence and payment in one workflow.',
  },
  {
    icon: Repeat2,
    title: 'Less coordination',
    description: 'Make smaller sponsorships easier to arrange and repeat.',
  },
  {
    icon: Sparkles,
    title: 'New creator income',
    description: 'Turn everyday surfaces into earning opportunities.',
  },
  {
    icon: Megaphone,
    title: 'Distinctive brand exposure',
    description: 'Help brands find novel ways to get noticed by relevant audiences.',
  },
  {
    icon: Coins,
    title: 'Access to sponsorship revenue',
    description: 'Let investors buy and trade defined shares of future advertising income.',
  },
];

function FeatureGrid({
  items,
  columns = 3,
  numbered = false,
}: {
  items: { icon: LucideIcon; title: string; description: string }[];
  columns?: 3 | 4;
  numbered?: boolean;
}) {
  return (
    <div className={`why-feature-grid why-feature-grid-${columns}`}>
      {items.map((item, index) => (
        <article className="why-feature-card" key={item.title}>
          <div className="why-feature-top">
            <span className="why-feature-icon">
              <item.icon size={21} strokeWidth={1.6} aria-hidden="true" />
            </span>
            {numbered && <span className="why-feature-number">0{index + 1}</span>}
          </div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

export default function WhyPage() {
  return (
    <div className="mp-app why-app">
      <MarketNav />

      <main>
        <HeroShowcase />

        <section className="why-section" id="evidence" aria-labelledby="evidence-title">
          <div className="why-section-heading">
            <div>
              <div className="why-kicker">Campaign examples</div>
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
                <div className="why-amount" title={sale.amountNote}>
                  {sale.amount}
                </div>
                <h3>{sale.creator}</h3>
                <p className="why-surface">{sale.surface}</p>
              </article>
            ))}
          </EvidenceCarousel>

          <details className="why-research" id="all-campaigns">
            <summary>
              <span>
                <strong>All {sales.length} campaigns and sources</strong>
              </span>
              <ChevronDown size={19} />
            </summary>
            <div className="why-research-intro">
              Timelines refer to sales, not ad display periods. Unknown durations are marked.
              Original currencies are used unless an approximate USD conversion is noted.
            </div>
            <div className="why-research-grid">
              {sales.map((sale) => (
                <details className="why-research-item" key={sale.id}>
                  <summary>
                    <span className="why-research-thumb" aria-hidden="true">
                      {sale.featuredImage || sale.screenshot ? (
                        <img src={sale.featuredImage || sale.screenshot} alt="" loading="lazy" />
                      ) : (
                        sale.creator.slice(0, 1)
                      )}
                    </span>
                    <span className="why-research-name">
                      <strong>{sale.creator}</strong>
                      <span>{sale.surface}</span>
                    </span>
                    <span className="why-research-result">
                      <strong>{sale.amount}</strong>
                      <span>{sale.basis}</span>
                    </span>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="why-research-expanded">
                    <div className="why-research-timing">
                      <ClockIcon />
                      <strong>{sale.timing}</strong>
                    </div>
                    <p>{sale.timingNote}</p>
                    <p>{sale.note}</p>
                    {sale.amountNote && <p>{sale.amountNote}</p>}
                    <SourceLinks sale={sale} />
                  </div>
                </details>
              ))}
            </div>
          </details>
        </section>

        <section
          className="why-section why-explainer"
          id="how-it-works"
          aria-labelledby="product-title"
        >
          <div className="why-section-heading why-explainer-heading">
            <div>
              <div className="why-kicker">How it works</div>
              <h2 id="product-title">From your space to their next campaign.</h2>
            </div>
          </div>
          <FeatureGrid items={steps} columns={4} numbered />
          <p className="why-section-note">
            Each placement can host its own brand. Run another campaign after the previous one
            settles.
          </p>
        </section>

        <section className="why-section why-explainer" id="onchain" aria-labelledby="onchain-title">
          <div className="why-section-heading why-explainer-heading">
            <div>
              <div className="why-kicker">Payments and ownership</div>
              <h2 id="onchain-title">Clear terms. Connected payments.</h2>
            </div>
          </div>
          <FeatureGrid items={paymentFeatures} />
          <p className="why-section-note">
            Photo verification checks artwork and placement, not continuous exposure. Refunds
            require an administrator’s review.
          </p>
        </section>

        <section className="why-section why-explainer" aria-labelledby="financing-title">
          <div className="why-section-heading why-explainer-heading">
            <div>
              <div className="why-kicker">Optional financing</div>
              <h2 id="financing-title">Sell a share of future ad revenue.</h2>
            </div>
          </div>
          <FeatureGrid items={financingSteps} numbered />
          <p className="why-section-note">
            Owners define the percentage and term. Token holders share eligible advertising
            receipts; returns are not guaranteed.
          </p>
        </section>

        <section
          className="why-section why-explainer why-value-section"
          aria-labelledby="value-title"
        >
          <div className="why-section-heading why-explainer-heading">
            <div>
              <div className="why-kicker">Why Placed</div>
              <h2 id="value-title">More possibilities for every space.</h2>
            </div>
          </div>
          <FeatureGrid items={valueProps} columns={4} />
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
