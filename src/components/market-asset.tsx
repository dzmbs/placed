'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, ImagePlus, RotateCcw } from 'lucide-react';
import { assetCategory, topBid, UNIT, type Artwork } from '@/lib/market';
import { useMarket, MarketDialog } from './market-provider';
import { Badge, Empty, MarketUnavailable, MarketShell, PageTitle } from './market-ui';
import { BiddingPanel, CampaignForm, ProofPanel } from './market-campaign';
import { MediaInput } from './market-media';
import { FinanceForm, InvestmentPanel, RevenueTerms, TradingPanel } from './market-finance';
import type { CameraCommand } from './viewer';
const Viewer = dynamic(() => import('./viewer'), {
  ssr: false,
  loading: () => <div className="viewer-loading">Loading preview…</div>,
});

export default function MarketAssetPage({
  id,
  initialSlot,
  initialTab,
  initialCampaign,
}: {
  id: string;
  initialSlot?: string;
  initialTab?: string;
  initialCampaign?: string;
}) {
  const { state, notify } = useMarket(),
    [selected, setSelected] = useState(initialSlot ?? ''),
    [selectedTab, setTab] = useState<'advertise' | 'invest' | 'trade'>(
      initialTab === 'invest' || initialTab === 'trade' ? initialTab : 'advertise',
    ),
    [artworks, setArtworks] = useState<Record<string, Artwork>>({}),
    [modal, setModal] = useState<'campaign' | 'finance' | 'proof' | null>(null),
    [command, setCommand] = useState<CameraCommand>({ view: 'front', nonce: 0 });
  if (!state) return <MarketUnavailable />;
  const asset = state.assets.find((a) => a.id === id);
  if (!asset)
    return (
      <MarketShell>
        <Empty
          title="Listing not found"
          text="This listing may have been removed. Browse other ad spaces."
          href="/explore"
        />
      </MarketShell>
    );
  const slot = asset.draft.spots.find((s) => s.id === selected) ?? asset.draft.spots[0],
    campaigns = state.campaigns.filter((c) => c.assetId === id && c.slotId === slot?.id),
    currentCampaign = campaigns.at(-1),
    campaign = campaigns.find((c) => c.id === initialCampaign) ?? currentCampaign,
    historical = Boolean(campaign && currentCampaign && campaign.id !== currentCampaign.id),
    own = state.current === asset.owner,
    tab = asset.financing ? selectedTab : 'advertise',
    creator = state.people.find((person) => person.id === asset.owner)?.name;
  const canUpdateArtwork = Boolean(
      campaign?.status === 'booked' &&
      campaign.artworkPermission &&
      state.current &&
      topBid(campaign)?.user === state.current,
    ),
    canPreview =
      canUpdateArtwork ||
      (!historical && (!campaign || campaign.status === 'open' || campaign.status === 'no-sale'));
  const draft = {
    ...asset.draft,
    spots: asset.draft.spots.map((s) => {
      const c =
        s.id === slot?.id
          ? campaign
          : state.campaigns.filter((c) => c.assetId === id && c.slotId === s.id).at(-1);
      return {
        ...s,
        price: c && topBid(c) ? topBid(c)!.amount / UNIT : s.price,
        artwork:
          (s.id === slot?.id && canPreview && artworks[s.id]?.url) ||
          c?.publicArtwork?.url ||
          (s.id === slot?.id && historical ? undefined : s.artwork),
      };
    }),
  };
  const select = (id: string | null) => {
    if (!id) return;
    setSelected(id);
    setCommand((c) => ({ view: 'spot', nonce: c.nonce + 1 }));
  };
  return (
    <MarketShell>
      <Link className="mp-back" href="/explore">
        <ArrowLeft size={15} />
        All spaces
      </Link>
      <PageTitle
        eyebrow={assetCategory(asset)}
        title={asset.name}
        text={`${creator ? `By ${creator} · ` : ''}${asset.draft.spots.length} placement${asset.draft.spots.length === 1 ? '' : 's'}`}
        action={
          own && !asset.financing ? (
            <button className="mp-button" onClick={() => setModal('finance')}>
              Raise capital <ArrowUpRight size={17} />
            </button>
          ) : undefined
        }
      />
      {asset.financing && (
        <div className="mp-tabs mp-asset-tabs" aria-label="Listing sections">
          <button
            aria-pressed={tab === 'advertise'}
            className={tab === 'advertise' ? 'active' : ''}
            onClick={() => setTab('advertise')}
          >
            Advertise
          </button>
          <button
            aria-pressed={tab === 'invest'}
            className={tab === 'invest' ? 'active' : ''}
            onClick={() => setTab('invest')}
          >
            Token sale
          </button>
          <button
            aria-pressed={tab === 'trade'}
            className={tab === 'trade' ? 'active' : ''}
            onClick={() => setTab('trade')}
          >
            Trade
          </button>
        </div>
      )}
      <div className="mp-asset-layout">
        <div className="mp-stack mp-asset-preview">
          {tab === 'advertise' ? (
            <>
              <div className="mp-asset-viewer">
                <Viewer
                  draft={draft}
                  selectedId={slot?.id ?? null}
                  onSelect={select}
                  placing={false}
                  onPlace={() => {}}
                  command={command}
                  autoRotate={false}
                  showSpots
                  preview
                  exportNonce={0}
                  onError={notify}
                />
                <div className="mp-viewer-caption">
                  <Badge>3D preview</Badge>
                  <button
                    aria-label="Reset asset view"
                    onClick={() => setCommand((c) => ({ view: 'front', nonce: c.nonce + 1 }))}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <span className="mp-viewer-hint">Drag to orbit · Scroll to zoom</span>
              </div>
              {tab === 'advertise' && asset.draft.spots.length > 1 && (
                <div className="mp-slot-buttons" aria-label="Ad placements">
                  {asset.draft.spots.map((s, i) => (
                    <button
                      key={s.id}
                      aria-pressed={slot?.id === s.id}
                      onClick={() => select(s.id)}
                      className={slot?.id === s.id ? 'selected' : ''}
                    >
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : asset.financing ? (
            <RevenueTerms asset={asset} financing={asset.financing} />
          ) : null}
        </div>
        <div className="mp-stack mp-asset-action">
          {historical && slot && tab === 'advertise' && (
            <div className="mp-inline-note">
              <span>Past campaign</span>
              <Link
                className="mp-button"
                href={`/assets/${encodeURIComponent(asset.id)}?${new URLSearchParams({ slot: slot.id, tab })}`}
              >
                Back to current campaign
              </Link>
            </div>
          )}
          {tab === 'advertise' ? (
            slot ? (
              <>
                {canPreview && (
                  <section className="mp-box mp-logo-preview">
                    <div className="mp-section-heading">
                      <h2>
                        <ImagePlus size={22} />{' '}
                        {canUpdateArtwork ? 'Preview new artwork' : 'Try your logo'}
                      </h2>
                      <Badge>Only you see this</Badge>
                    </div>
                    <p className="mp-muted">
                      See your artwork on {slot.name} before{' '}
                      {canUpdateArtwork ? 'updating it' : 'you bid'}.
                    </p>
                    <MediaInput
                      key={slot.id}
                      value={artworks[slot.id]}
                      preview
                      onChange={(art) => {
                        setArtworks((a) => ({ ...a, [slot.id]: art }));
                        select(slot.id);
                      }}
                      onRemove={() =>
                        setArtworks((a) => {
                          const next = { ...a };
                          delete next[slot.id];
                          return next;
                        })
                      }
                    />
                    <p className="mp-small mp-muted">
                      {canUpdateArtwork
                        ? 'Public artwork changes only after you confirm an update.'
                        : 'No wallet needed to preview. Your logo is submitted when you bid.'}
                    </p>
                  </section>
                )}
                <BiddingPanel
                  key={campaign?.id ?? slot?.id}
                  asset={asset}
                  campaign={campaign}
                  artwork={artworks[slot.id]}
                  onCreate={() => setModal('campaign')}
                  onProof={() => setModal('proof')}
                  canCreate={!historical}
                />
              </>
            ) : (
              <Empty
                title="No placements available"
                text="This listing has no ad placements yet."
              />
            )
          ) : tab === 'invest' ? (
            <InvestmentPanel asset={asset} />
          ) : (
            <TradingPanel asset={asset} />
          )}
        </div>
        <div className="mp-stack mp-asset-details">
          <section className="mp-box">
            <h2>About this space</h2>
            <p>{asset.description}</p>
            {asset.draft.campaign.deliverables &&
              asset.draft.campaign.deliverables !== asset.description && (
                <div className="mp-note">{asset.draft.campaign.deliverables}</div>
              )}
            {asset.ens && <p className="mp-small mp-muted">{asset.ens}</p>}
          </section>
        </div>
      </div>
      {modal === 'campaign' && slot && (
        <MarketDialog title="Create campaign" close={() => setModal(null)}>
          <CampaignForm asset={asset} slotId={slot.id} close={() => setModal(null)} />
        </MarketDialog>
      )}
      {modal === 'finance' && (
        <MarketDialog title="Create a token sale" close={() => setModal(null)}>
          <FinanceForm
            asset={asset}
            close={() => {
              setModal(null);
              setTab('invest');
            }}
          />
        </MarketDialog>
      )}
      {modal === 'proof' && campaign && (
        <MarketDialog title="Submit proof" close={() => setModal(null)}>
          <ProofPanel campaign={campaign} close={() => setModal(null)} />
        </MarketDialog>
      )}
    </MarketShell>
  );
}
