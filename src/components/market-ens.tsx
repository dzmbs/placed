'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AtSign, KeyRound, Lock } from 'lucide-react';
import { topBid, type CampaignRecord, type MarketAsset, type Person } from '@/lib/market';
import { contracts } from '@/lib/marketplace/config';

const etherscan = (address: string) => `https://sepolia.etherscan.io/address/${address}`;
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

// The asset's ENSv2 identity: its subregistry name, each slot's own resolver,
// the records the app reads and who may currently write `ad.artwork`.
export function EnsIdentity({
  asset,
  campaigns,
  people,
}: {
  asset: MarketAsset;
  campaigns: CampaignRecord[];
  people: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      ) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [pinned]);
  if (!asset.ens) return null;
  const editor = (slotId: string) => {
    const campaign = campaigns.findLast((c) => c.slotId === slotId && c.artworkPermission);
    const winner = campaign && topBid(campaign);
    if (!winner) return undefined;
    return people.find((p) => p.id === winner.user)?.address ?? winner.user;
  };
  const visible = open || pinned;
  return (
    <div
      className="mp-ens"
      ref={root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="mp-ens-chip"
        aria-expanded={visible}
        aria-controls={`ens-${asset.id}`}
        onClick={() => setPinned(!pinned)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => !root.current?.contains(e.relatedTarget) && setOpen(false)}
      >
        <AtSign size={14} />
        {asset.ens}
      </button>
      {visible && (
        <div className="mp-ens-card" id={`ens-${asset.id}`} role="dialog" aria-label="ENSv2 name">
          <header>
            <span>ENSv2 on Sepolia</span>
            <strong>{asset.ens}</strong>
            <small>Own subregistry under placed-demo.eth</small>
          </header>
          {asset.metadataURI && (
            <a className="mp-ens-record" href={asset.metadataURI} target="_blank" rel="noreferrer">
              <code>ad.metadata</code>
              <ArrowUpRight size={12} />
            </a>
          )}
          <ol className="mp-ens-slots">
            {(asset.slotNames ?? []).map((slot) => {
              const winner = editor(slot.id);
              const label = asset.draft.spots.find((spot) => spot.id === slot.id)?.name;
              return (
                <li key={slot.id}>
                  <div className="mp-ens-slot-name">
                    <strong>{slot.ens}</strong>
                    {label && <span>{label}</span>}
                  </div>
                  <div className="mp-ens-slot-meta">
                    <a href={etherscan(slot.resolver)} target="_blank" rel="noreferrer">
                      Resolver {short(slot.resolver)} <ArrowUpRight size={11} />
                    </a>
                    {slot.artworkURI ? (
                      <a href={slot.artworkURI} target="_blank" rel="noreferrer">
                        <code>ad.artwork</code> <ArrowUpRight size={11} />
                      </a>
                    ) : (
                      <span className="mp-muted">
                        <code>ad.artwork</code> empty
                      </span>
                    )}
                  </div>
                  <p className={winner ? 'mp-ens-role granted' : 'mp-ens-role'}>
                    {winner ? <KeyRound size={12} /> : <Lock size={12} />}
                    {winner
                      ? `${short(winner)} can edit ad.artwork only, until the campaign ends`
                      : 'Only Placed can write this name'}
                  </p>
                </li>
              );
            })}
          </ol>
          <a
            className="mp-ens-footer"
            href={etherscan(contracts.naming)}
            target="_blank"
            rel="noreferrer"
          >
            Naming contract on Etherscan <ArrowUpRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
