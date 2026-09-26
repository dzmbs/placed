'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { assetCategory, display, minimumBid, topBid } from '@/lib/market';
import { useMarket } from './market-provider';
import { AssetArt } from './market-media';
import { Badge, Empty, MarketUnavailable, MarketShell, PageTitle } from './market-ui';

export default function MarketExplore() {
  const { state, refresh } = useMarket(),
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
  const openCampaigns = state.campaigns.filter(
    (c) => c.status === 'open' && c.opens <= state.now && c.closes > state.now,
  );
  const filtered = query.trim() !== '' || filter !== 'All spaces';
  return (
    <MarketShell>
      <PageTitle
        eyebrow="THE MARKETPLACE"
        title="A little space. A lot of possibility."
        text="Find a place for your brand. Or make a place for someone else’s."
        action={
          <Link className="mp-button primary" href="/studio">
            <Plus size={18} /> List ad space
          </Link>
        }
      />
      <section className="mp-discover-results" aria-label="Available ad spaces">
        {!!state.unavailableListingCount && (
          <div className="mp-service-error" role="status">
            <span>
              {state.unavailableListingCount === 1
                ? 'One listing is temporarily unavailable because its details could not be loaded.'
                : `${state.unavailableListingCount} listings are temporarily unavailable because their details could not be loaded.`}
            </span>
            <button className="mp-button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        )}
        <div className="mp-results-heading">
          <h2>
            Explore spaces <span>{assets.length}</span>
          </h2>
          <span className="mp-live-count">
            <i />
            {openCampaigns.length} open {openCampaigns.length === 1 ? 'auction' : 'auctions'}
          </span>
        </div>
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
          <div
            className={`mp-grid mp-discover-grid ${assets.length === 1 ? 'mp-single-listing' : ''}`}
          >
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
                  <div className="mp-listing-visual">
                    <AssetArt asset={asset} />
                    <span className={`mp-listing-status ${campaigns.length ? 'is-live' : ''}`}>
                      {campaigns.length
                        ? `${campaigns.length} open ${campaigns.length === 1 ? 'auction' : 'auctions'}`
                        : 'Discover this space'}
                    </span>
                    <span className="mp-listing-arrow">
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
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
                      {creator
                        ? ` · ${/^0x[a-fA-F0-9]{40}$/.test(creator) ? `${creator.slice(0, 6)}…${creator.slice(-4)}` : creator}`
                        : ''}
                    </p>
                    <p className="mp-listing-description">{asset.description}</p>
                    <div className="mp-card-price">
                      <span>
                        {startingBid === null ? (
                          <>
                            <span>Not accepting bids yet</span>
                            <strong className="mp-view-space">Explore placements</strong>
                          </>
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
            <SlidersHorizontal size={28} />
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
          <Empty
            title={
              state.unavailableListingCount
                ? 'No ad spaces available to browse right now'
                : 'No ad spaces listed yet'
            }
            text={
              state.unavailableListingCount
                ? 'Please check back when listing details are available.'
                : 'New listings will appear here.'
            }
          />
        )}
      </section>
      <Link className="mp-create-banner" href="/studio">
        <span className="mp-create-icon">
          <Plus size={26} />
        </span>
        <div>
          <span className="mp-eyebrow">YOUR SPACE COULD BE NEXT</span>
          <h2>An outfit. A stream. Something entirely new.</h2>
          <p>Map your placements in Studio and give brands a place to show up.</p>
        </div>
        <span className="mp-button dark">
          Create a space <ArrowRight size={17} />
        </span>
      </Link>
    </MarketShell>
  );
}
