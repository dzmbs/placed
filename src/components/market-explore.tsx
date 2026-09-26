'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { assetCategory, display, minimumBid, topBid } from '@/lib/market';
import { useMarket } from './market-provider';
import { AssetArt } from './market-media';
import { Badge, Empty, MarketUnavailable, MarketShell, PageTitle } from './market-ui';

export default function MarketExplore() {
  const { state } = useMarket(),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All spaces');
  if (!state) return <MarketUnavailable />;
  const assets = state.assets.filter(
    (asset) =>
      `${asset.name} ${asset.description} ${asset.ens} ${assetCategory(asset)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === 'All spaces' ||
        (filter === 'Revenue tokens'
          ? !!asset.financing
          : filter === 'Digital'
            ? ['twitch', 'x-banner', 'digital'].includes(asset.draft.asset)
            : !['twitch', 'x-banner', 'digital'].includes(asset.draft.asset))),
  );
  const filtered = query.trim() !== '' || filter !== 'All spaces';
  return (
    <MarketShell>
      <PageTitle
        title="Find ad space"
        text="Book a creator’s ad placement or explore their revenue tokens."
        action={
          <Link className="mp-button primary" href="/studio">
            <Plus size={18} /> List ad space
          </Link>
        }
      />
      <section aria-label="Available ad spaces">
        <div className="mp-filterbar">
          <div className="mp-tabs" aria-label="Filter ad spaces">
            {['All spaces', 'Physical', 'Digital', 'Revenue tokens'].map((label) => (
              <button
                key={label}
                aria-pressed={filter === label}
                className={filter === label ? 'active' : ''}
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mp-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Search ad spaces"
              placeholder="Search ad spaces"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {assets.length ? (
          <div className="mp-grid">
            {assets.map((asset) => {
              const campaigns = state.campaigns.filter(
                (campaign) =>
                  campaign.assetId === asset.id &&
                  campaign.status === 'open' &&
                  campaign.opens <= state.now &&
                  campaign.closes > state.now,
              );
              const high = Math.max(
                0,
                ...campaigns.map((campaign) => topBid(campaign)?.amount ?? 0),
              );
              const startingBid = campaigns.length
                ? Math.min(...campaigns.map((campaign) => minimumBid(campaign)))
                : null;
              const creator = state.people.find((person) => person.id === asset.owner)?.name;
              return (
                <Link key={asset.id} className="mp-card" href={`/assets/${asset.id}`}>
                  <AssetArt asset={asset} />
                  <div className="mp-card-body">
                    <div className="mp-card-top">
                      <span className="mp-eyebrow">{assetCategory(asset)}</span>
                      {asset.financing &&
                        ['active', 'fundraising'].includes(asset.financing.status) && (
                          <Badge tone="green">
                            {asset.financing.status === 'active' ? 'Trading open' : 'Token sale'}
                          </Badge>
                        )}
                    </div>
                    <h3>{asset.name}</h3>
                    <p>
                      {asset.draft.spots.length} placement
                      {asset.draft.spots.length === 1 ? '' : 's'}
                      {creator ? ` · ${creator}` : ''}
                    </p>
                    <div className="mp-card-price">
                      <span>
                        {startingBid === null ? (
                          'No open auctions'
                        ) : (
                          <>
                            {high ? 'Highest bid' : 'Bids from'}
                            <strong>
                              {display(high || startingBid)} <small>USDC</small>
                            </strong>
                          </>
                        )}
                      </span>
                      <ArrowUpRight size={21} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : filtered ? (
          <div className="mp-empty">
            <h2>No matching spaces</h2>
            <p>Try a different search or clear the filters.</p>
            <button
              className="mp-button"
              onClick={() => {
                setQuery('');
                setFilter('All spaces');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <Empty title="No ad spaces listed yet" text="New listings will appear here." />
        )}
      </section>
    </MarketShell>
  );
}
