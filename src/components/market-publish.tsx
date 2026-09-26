'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { safeDraft } from '@/lib/studio';
import type { Draft } from '@/lib/types';
import { PENDING_KEY } from '@/lib/market';
import { useMarket } from './market-provider';
import {
  AccessButton,
  Empty,
  Loading,
  MarketUnavailable,
  MarketShell,
  PageTitle,
  Rows,
} from './market-ui';
const Viewer = dynamic(() => import('./viewer'), {
  ssr: false,
  loading: () => <div className="viewer-loading">Loading preview…</div>,
});

export default function MarketPublish() {
  const { state, transact, notify } = useMarket(),
    router = useRouter(),
    [draft, setDraft] = useState<Draft | null>(null),
    [loaded, setLoaded] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState('');
  useEffect(() => {
    try {
      const d = safeDraft(JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null'));
      if (d) {
        setDraft(d);
        setName(d.assetName || d.campaign.title);
        setDescription(d.campaign.deliverables);
      }
    } catch {}
    setLoaded(true);
  }, []);
  if (!loaded) return <Loading />;
  if (!state) return <MarketUnavailable />;
  if (!draft)
    return (
      <MarketShell>
        <Empty
          title="Create your ad space first"
          text="Add your placements in Studio, then choose Publish canvas."
          href="/studio"
          action="Open Studio"
        />
      </MarketShell>
    );
  return (
    <MarketShell>
      <PageTitle
        title="Publish your listing"
        text="Review your ad space. You can set auction terms for each placement after publishing."
      />
      <div className="mp-asset-layout">
        <section className="mp-box">
          <div className="mp-asset-viewer">
            <Viewer
              draft={draft}
              selectedId={null}
              onSelect={() => {}}
              placing={false}
              onPlace={() => {}}
              command={{ view: 'front', nonce: 0 }}
              autoRotate={false}
              showSpots
              preview
              exportNonce={0}
              onError={notify}
            />
            <span className="mp-viewer-hint">Drag to inspect your placements</span>
          </div>
          <Rows
            rows={[
              ['Placements', String(draft.spots.length)],
              ['Campaign', draft.campaign.title],
            ]}
          />
        </section>
        <section className="mp-box">
          <h2>Listing details</h2>
          <label className="mp-field">
            Listing name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </label>
          <label className="mp-field">
            Description
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={800}
            />
          </label>
          <p className="mp-small mp-muted">
            Describe where the ad will appear and what the sponsor receives.
          </p>
          {draft.spots.length === 0 && (
            <p className="mp-error">Add at least one placement in Studio before publishing.</p>
          )}
          <AccessButton
            verified
            disabled={!name.trim() || !description.trim() || !draft.spots.length}
            onClick={() =>
              transact(
                'Publish listing',
                `Publish ${name.trim()} with ${draft.spots.length} ad placement${draft.spots.length === 1 ? '' : 's'}. You can create auctions after the listing is confirmed.`,
                { type: 'publish', draft, name, description },
                () => router.push('/portfolio?tab=creator'),
              )
            }
          >
            Publish listing
          </AccessButton>
          <Link className="mp-button full" href="/studio">
            Back to Studio
          </Link>
        </section>
      </div>
    </MarketShell>
  );
}
