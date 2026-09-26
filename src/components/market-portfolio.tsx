'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { campaignStatus, dateLabel, display, mulDiv, redemptionReady, topBid } from '@/lib/market';
import { useMarket } from './market-provider';
import {
  AccessButton,
  Badge,
  Empty,
  MarketUnavailable,
  MarketShell,
  PageTitle,
  Rows,
} from './market-ui';

export default function MarketPortfolio({ initialTab = 'holdings' }: { initialTab?: string }) {
  const { state, wallet, transact, verify } = useMarket(),
    [tab, setTab] = useState(
      ['holdings', 'advertising', 'creator'].includes(initialTab) ? initialTab : 'holdings',
    );
  if (!state) return <MarketUnavailable />;
  const user = state.people.find((p) => p.id === state.current),
    holdings = state.assets.filter(
      (a) =>
        a.financing &&
        ((a.financing.holdings[state.current ?? ''] ?? 0) > 0 ||
          a.financing.redemptions?.[state.current ?? ''] !== undefined ||
          a.financing.bids.some((b) => b.user === state.current && !b.claimed)),
    ),
    owned = state.assets.filter((a) => a.owner === state.current),
    bids = state.campaigns.filter((c) => c.bids.some((b) => b.user === state.current)),
    credit = state.credits[state.current ?? ''] ?? 0;
  return (
    <MarketShell>
      <PageTitle
        title="Portfolio"
        text="Manage your tokens, bids and listings."
        action={
          user ? (
            <Link className="mp-button" href="/studio">
              <Plus size={18} /> List ad space
            </Link>
          ) : undefined
        }
      />
      {user ? (
        <>
          <div className="mp-balance-grid">
            <div>
              <span>Available balance</span>
              <strong>
                {display(user.usdc)} <small>USDC</small>
              </strong>
            </div>
            <div>
              <span>Available to withdraw</span>
              <strong>
                {display(credit)} <small>USDC</small>
              </strong>
              {credit > 0 && (
                <AccessButton
                  className="mp-button"
                  onClick={() =>
                    transact(
                      'Withdraw outbid funds',
                      `Withdraw ${display(credit)} USDC from outbid bids to your wallet.`,
                      { type: 'withdraw' },
                    )
                  }
                >
                  Withdraw funds
                </AccessButton>
              )}
            </div>
          </div>
          {!user.verified && tab !== 'holdings' && (
            <div className="mp-inline-note">
              <span>Verify your identity to bid or publish a listing.</span>
              <button className="mp-button" onClick={verify}>
                Verify identity
              </button>
            </div>
          )}
          <div className="mp-tabs">
            {[
              ['holdings', 'Revenue tokens'],
              ['advertising', 'Bids & bookings'],
              ['creator', 'My listings'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                className={tab === key ? 'active' : ''}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'holdings' &&
            (holdings.length ? (
              <div className="mp-stack">
                {holdings.map((asset) => {
                  const f = asset.financing!,
                    tokens = f.holdings[user.id] ?? 0,
                    ready = redemptionReady(state, asset),
                    redeemed = tokens === 0 && f.redemptions?.[user.id] !== undefined,
                    unclaimed = f.bids.filter((b) => b.user === user.id && !b.claimed),
                    covered = state.campaigns.filter((c) => c.series === f.id),
                    settled = covered.filter((c) =>
                      ['completed', 'refunded', 'no-sale'].includes(c.status),
                    );
                  return (
                    <section className="mp-box" key={asset.id}>
                      <div className="mp-section-heading">
                        <div>
                          <span className="mp-eyebrow">{f.symbol}</span>
                          <h2>{f.name}</h2>
                        </div>
                        <Badge tone={ready ? 'green' : 'amber'}>
                          {redeemed
                            ? 'Redeemed'
                            : ready
                              ? 'Redemption open'
                              : state.now >= f.end
                                ? 'Awaiting settlement'
                                : f.status === 'active'
                                  ? 'Term active'
                                  : {
                                      fundraising: 'Token sale open',
                                      migration: 'Awaiting activation',
                                      failed: 'Sale unsuccessful',
                                      deadline: 'Activation expired',
                                    }[f.status]}
                        </Badge>
                      </div>
                      <div className="mp-holdings-grid">
                        <div>
                          <span>Your tokens</span>
                          <strong>
                            {display(tokens)} {f.symbol}
                          </strong>
                        </div>
                        <div>
                          <span>Revenue available</span>
                          <strong>{display(f.vault)} USDC</strong>
                        </div>
                        <div>
                          <span>{redeemed ? 'Redeemed' : 'Your share to date'}</span>
                          <strong>
                            {display(
                              redeemed
                                ? f.redemptions![user.id]
                                : f.remainingSupply
                                  ? mulDiv(f.vault, tokens, f.remainingSupply)
                                  : 0,
                              6,
                            )}{' '}
                            USDC
                          </strong>
                        </div>
                      </div>
                      <Rows
                        rows={[
                          ['Revenue term ends', dateLabel(f.end)],
                          ['Campaigns settled', `${settled.length} / ${covered.length}`],
                        ]}
                      />
                      {redeemed ? (
                        <p className="mp-note green">
                          Revenue paid to your wallet. These tokens have been burned.
                        </p>
                      ) : ready && tokens > 0 ? (
                        <AccessButton
                          onClick={() =>
                            transact(
                              'Redeem revenue tokens',
                              `Redeem ${display(tokens)} ${f.symbol} for your share of the collected revenue. These tokens will be burned.`,
                              { type: 'redeem', assetId: asset.id },
                            )
                          }
                        >
                          Redeem {display(tokens)} {f.symbol}
                        </AccessButton>
                      ) : (
                        <p className="mp-note">
                          Redeem after the revenue term ends and all campaigns settle.
                        </p>
                      )}
                      {unclaimed.length > 0 && (
                        <div className="mp-inline-note">
                          <span>
                            {display(unclaimed.reduce((sum, b) => sum + b.budget, 0))} USDC{' '}
                            {f.status === 'fundraising'
                              ? 'committed to the token sale'
                              : 'awaiting claim'}
                          </span>
                          {f.status !== 'fundraising' && (
                            <AccessButton
                              onClick={() =>
                                transact(
                                  'Claim sale allocation',
                                  'Claim purchased tokens and any unspent budget. Failed sales refund the full budget.',
                                  { type: 'sale-claim', assetId: asset.id },
                                )
                              }
                            >
                              Claim allocation
                            </AccessButton>
                          )}
                        </div>
                      )}
                      <div className="mp-actions">
                        <Link
                          className="mp-button"
                          href={`/assets/${asset.id}?tab=${f.status === 'active' ? 'trade' : 'invest'}`}
                        >
                          {f.status === 'active' ? 'Trade tokens' : 'View token sale'}{' '}
                          <ArrowUpRight size={17} />
                        </Link>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <Empty
                title="No revenue tokens yet"
                text="Browse token sales or trade tokens from listed creators."
                href="/"
              />
            ))}
          {tab === 'advertising' && (
            <div className="mp-stack">
              {bids.length ? (
                bids.map((c) => {
                  const asset = state.assets.find((a) => a.id === c.assetId),
                    winner = topBid(c);
                  if (!asset) return null;
                  return (
                    <section className="mp-box" key={c.id}>
                      <div className="mp-section-heading">
                        <h3>
                          {asset.name} · {asset.draft.spots.find((s) => s.id === c.slotId)?.name}
                        </h3>
                        <Badge tone={winner?.user === user.id ? 'green' : 'amber'}>
                          {winner?.user === user.id
                            ? c.status === 'open'
                              ? 'Highest bidder'
                              : campaignStatus(c, state.now)
                            : 'Outbid'}
                        </Badge>
                      </div>
                      <Rows
                        rows={[
                          [
                            'Your latest bid',
                            `${display(c.bids.filter((b) => b.user === user.id).at(-1)!.amount)} USDC`,
                          ],
                          ['Payment held', `${display(c.held)} USDC`],
                          ['Display ends', dateLabel(c.end)],
                        ]}
                      />
                      <Link
                        className="mp-button"
                        href={`/assets/${encodeURIComponent(asset.id)}?${new URLSearchParams({ slot: c.slotId, campaign: c.id, tab: 'advertise' })}`}
                      >
                        View booking & artwork <ArrowUpRight size={17} />
                      </Link>
                    </section>
                  );
                })
              ) : (
                <Empty title="No bids yet" text="Find an ad placement and place a bid." href="/" />
              )}
            </div>
          )}
          {tab === 'creator' &&
            (owned.length ? (
              <div className="mp-stack">
                {owned.map((asset) => (
                  <section className="mp-box" key={asset.id}>
                    <div className="mp-section-heading">
                      <div>
                        {asset.ens && <span className="mp-eyebrow">{asset.ens}</span>}
                        <h2>{asset.name}</h2>
                      </div>
                    </div>
                    <p className="mp-muted">{asset.description}</p>
                    <div className="mp-campaign-links">
                      {asset.draft.spots.map((slot) => {
                        const c = state.campaigns
                          .filter((c) => c.assetId === asset.id && c.slotId === slot.id)
                          .at(-1);
                        return (
                          <Link key={slot.id} href={`/assets/${asset.id}?slot=${slot.id}`}>
                            <span>
                              <strong>{slot.name}</strong>
                              <small>{c ? campaignStatus(c, state.now) : 'No campaign'}</small>
                            </span>
                            <span>
                              {c ? `${display(c.held)} USDC held` : 'Create campaign'}{' '}
                              <ArrowUpRight size={16} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Empty
                title="No listings yet"
                text="Add your ad space and placements in Studio, then publish your listing."
                href="/studio"
                action="List ad space"
              />
            ))}
          {state.receipts.some((receipt) => receipt.user === user.id) && (
            <section className="mp-box mp-activity">
              <h3>Recent activity</h3>
              {state.receipts
                .filter((r) => r.user === user.id)
                .slice(0, 8)
                .map((r) => (
                  <div key={r.id}>
                    <span>{r.title.replaceAll('-', ' ')}</span>
                    <small>{dateLabel(r.at)}</small>
                  </div>
                ))}
            </section>
          )}
        </>
      ) : (
        <div className="mp-empty">
          <h2>Connect your wallet</h2>
          <p>Your tokens, bids and listings will appear here.</p>
          <button className="mp-button primary" onClick={wallet}>
            Connect wallet
          </button>
        </div>
      )}
    </MarketShell>
  );
}
