'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Asset } from '@/lib/marketplace/domain';
import type { Spot, Vec3 } from '@/lib/types';
import * as client from '@/lib/marketplace/client';
import { splitAdvertisingPayment, usdcAmount } from '@/lib/marketplace/math';
import { useMarketplace } from './context';
import {
  Viewer,
  useRecord,
  useClock,
  assetDraft,
  dollars,
  time,
  Metrics,
  ErrorMessage,
} from './shared';
import CampaignForm from './campaign-form';
import { FinancingForm, InvestmentPanel } from './investment';
import styles from './marketplace.module.css';

export default function AssetPage({ id }: { id: string }) {
  const market = useMarketplace();
  const { record: asset, error } = useRecord<Asset>(`/assets/${id}`);
  const now = useClock();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'advertise' | 'invest'>('advertise');
  const [command, setCommand] = useState({
    view: 'front' as 'front' | 'back' | 'side' | 'iso' | 'spot',
    nonce: 0,
  });
  const [logo, setLogo] = useState<File>();
  const [logoURL, setLogoURL] = useState<string>();
  const [bid, setBid] = useState('1');
  const [viewerError, setViewerError] = useState('');
  const [raise, setRaise] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placement, setPlacement] = useState<Spot>();
  const [slotName, setSlotName] = useState('Front of shirt');
  useEffect(() => {
    if (asset && !asset.slots.some((s) => s.id === selected))
      setSelected(asset.slots[0]?.id || null);
  }, [asset, selected]);
  useEffect(() => {
    if (!logo) {
      setLogoURL(undefined);
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoURL(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  const slot = asset?.slots.find((slot) => slot.id === selected);
  const campaign = slot?.campaign;
  useEffect(() => {
    setLogo(undefined);
    if (campaign) setBid(String(Number(BigInt(campaign.minimumBid)) / 1e6));
  }, [selected, campaign?.minimumBid]);
  if (!asset)
    return (
      <>
        <h1>Advertising asset</h1>
        <ErrorMessage error={error} />
        {!error && <p>Resolving asset through ENSv2…</p>}
      </>
    );
  const creator = market.wallet?.toLowerCase() === asset.creator.wallet.toLowerCase();
  const draft = assetDraft(asset);
  if (logoURL && selected)
    draft.spots = draft.spots.map((spot) =>
      spot.id === selected ? { ...spot, artwork: logoURL } : spot,
    );
  if (placement) draft.spots.push(placement);
  function select(id: string | null) {
    setSelected(id);
    setCommand({ view: 'spot', nonce: Date.now() });
  }
  function place(position: Vec3, rotation: Vec3, meshName: string) {
    setPlacement({
      id: 'new-placement',
      name: slotName,
      position,
      rotation,
      meshName,
      projection: true,
      width: 0.4,
      height: 0.3,
      price: 0,
    });
    setPlacing(false);
  }
  const split = campaign
    ? splitAdvertisingPayment(BigInt(campaign.bid), campaign.escrowBps, campaign.revenueBps)
    : undefined;
  return (
    <>
      <p className={styles.eyebrow}>{asset.ensName}</p>
      <h1>{asset.metadata?.title || `Asset ${id}`}</h1>
      <p className={styles.muted}>{asset.metadata?.description}</p>
      <div className={styles.split}>
        <div>
          <div className={styles.viewer}>
            <Viewer
              draft={draft}
              selectedId={selected}
              onSelect={select}
              placing={placing}
              onPlace={place}
              command={command}
              autoRotate={false}
              showSpots
              preview={!!logoURL}
              exportNonce={0}
              onError={setViewerError}
            />
          </div>
          <div className={styles.controls}>
            {(['front', 'back', 'side', 'iso'] as const).map((view) => (
              <button key={view} onClick={() => setCommand({ view, nonce: Date.now() })}>
                {view}
              </button>
            ))}
            <button
              onClick={() => {
                setLogo(undefined);
                setCommand({ view: 'spot', nonce: Date.now() });
              }}
            >
              Public artwork
            </button>
          </div>
          <ErrorMessage error={viewerError || error} />
          <p className={styles.muted}>
            {logoURL
              ? 'Private logo preview. Public artwork changes only through the winning campaign or the winner’s ENS permission.'
              : 'Live artwork resolves from each slot’s dedicated ENSv2 resolver.'}
          </p>
          <p className={styles.code}>Creator: {asset.creator.wallet}</p>
          {creator && (
            <section className={styles.panel}>
              <h2>Asset dashboard</h2>
              <p>
                {asset.financing
                  ? 'One financing series covers current and future slots during its fixed term.'
                  : 'Advertising works without financing. Raise capital only if you want to sell a share of future advertising receipts.'}
              </p>
              <div className={styles.controls}>
                <button
                  disabled={market.busy}
                  onClick={() => {
                    setPlacing(true);
                    setPlacement(undefined);
                  }}
                >
                  Add a slot
                </button>
                {!asset.financing && (
                  <button onClick={() => setRaise(!raise)}>Raise capital</button>
                )}
              </div>
              {placing && <p>Click the model to place the new slot.</p>}
              {placement && (
                <>
                  <label>
                    New slot name
                    <input value={slotName} onChange={(e) => setSlotName(e.target.value)} />
                  </label>
                  <label>
                    Width
                    <input
                      type="range"
                      min=".05"
                      max="1.5"
                      step=".01"
                      value={placement.width}
                      onChange={(e) =>
                        setPlacement({ ...placement, width: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="range"
                      min=".05"
                      max="1.5"
                      step=".01"
                      value={placement.height}
                      onChange={(e) =>
                        setPlacement({ ...placement, height: Number(e.target.value) })
                      }
                    />
                  </label>
                  <button
                    disabled={market.busy}
                    onClick={() =>
                      void market.run('Create independently bookable slot', async () => {
                        const session = await market.authenticate();
                        const stored = await client.storeMetadata(session, 'slot', {
                          version: 1,
                          name: slotName,
                          placement: { ...placement, name: slotName },
                        });
                        const receipt = await client.createSlot(market.wallet!, id, stored.uri);
                        setPlacement(undefined);
                        return receipt;
                      })
                    }
                  >
                    Publish slot
                  </button>
                </>
              )}
            </section>
          )}
          {raise && !asset.financing && <FinancingForm asset={asset} />}
        </div>
        <div className={styles.stack}>
          <div className={styles.tabs}>
            <button
              className={tab === 'advertise' ? styles.active : undefined}
              onClick={() => setTab('advertise')}
            >
              Advertise
            </button>
            {asset.financing && (
              <button
                className={tab === 'invest' ? styles.active : undefined}
                onClick={() => setTab('invest')}
              >
                Invest
              </button>
            )}
          </div>
          {tab === 'invest' && asset.financing ? (
            <InvestmentPanel asset={asset} />
          ) : (
            <>
              <section className={styles.panel}>
                <h2>Choose a slot</h2>
                <div className={styles.controls}>
                  {asset.slots.map((slot) => (
                    <button
                      key={slot.id}
                      className={slot.id === selected ? styles.active : undefined}
                      onClick={() => select(slot.id)}
                    >
                      {slot.metadata?.name || `Slot ${slot.id}`}
                    </button>
                  ))}
                </div>
                {!asset.slots.length && (
                  <p>This asset has no slots yet. Its creator can add one to the model.</p>
                )}
                {slot && (
                  <>
                    <p className={styles.code}>{slot.ensName}</p>
                    <label>
                      Try your logo here
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setLogo(e.target.files?.[0])}
                      />
                    </label>
                    {campaign ? (
                      <>
                        <p className={styles.eyebrow}>{campaign.state}</p>
                        <Metrics
                          items={[
                            [
                              campaign.bid === '0' ? 'No bids yet' : 'Current bid',
                              dollars(campaign.bid),
                            ],
                            ['Minimum next bid', dollars(campaign.minimumBid)],
                            ['Campaign escrow', `${campaign.escrowBps / 100}%`],
                            ['Asset revenue share', `${campaign.revenueBps / 100}%`],
                          ]}
                        />
                        <p>
                          Display: {time(campaign.displayStart)} to {time(campaign.displayEnd)}
                        </p>
                        <p>
                          Bidding: {time(campaign.bidStart)} to {time(campaign.bidEnd)}
                        </p>
                        {campaign.state === 'bidding' && (
                          <>
                            <p className={styles.muted}>
                              {now < campaign.bidStart
                                ? 'Bidding has not opened.'
                                : now < campaign.bidEnd
                                  ? `${Math.max(0, Math.ceil(campaign.bidEnd - now))} seconds until bidding closes.`
                                  : 'Bidding closed. Finalization needs a transaction.'}
                            </p>
                            {now >= campaign.bidStart && now < campaign.bidEnd && (
                              <>
                                <label>
                                  Your funded bid, demo USDC
                                  <input
                                    value={bid}
                                    onChange={(e) => setBid(e.target.value)}
                                    inputMode="decimal"
                                  />
                                </label>
                                <div className={styles.controls}>
                                  <button
                                    disabled={market.busy || !market.wallet}
                                    onClick={() =>
                                      void market.run('Approve advertising USDC', () =>
                                        client.approveAdvertising(market.wallet!, usdcAmount(bid)),
                                      )
                                    }
                                  >
                                    1. Approve USDC
                                  </button>
                                  <button
                                    disabled={
                                      market.busy ||
                                      !market.balances?.authorized ||
                                      !logo ||
                                      creator
                                    }
                                    onClick={() =>
                                      void market.run('Submit funded advertising bid', async () => {
                                        const amount = usdcAmount(bid);
                                        if (amount < BigInt(campaign.minimumBid))
                                          throw Error('Your bid is below the minimum increase.');
                                        const stored = await client.uploadMedia(
                                          await market.authenticate(),
                                          logo!,
                                        );
                                        return client.placeAdvertisingBid(
                                          market.wallet!,
                                          campaign.id,
                                          amount,
                                          stored,
                                        );
                                      })
                                    }
                                  >
                                    2. Place bid
                                  </button>
                                </div>
                                <p className={styles.muted}>
                                  The full bid is reserved. If outbid, your full previous bid
                                  becomes withdrawable. A creator cannot bid on their own asset.
                                </p>
                              </>
                            )}
                            {now >= campaign.bidEnd && (
                              <button
                                disabled={market.busy || !market.wallet}
                                onClick={() =>
                                  void market.run('Finalize highest funded bid', () =>
                                    client.finalizeCampaign(market.wallet!, campaign.id),
                                  )
                                }
                              >
                                Finalize campaign
                              </button>
                            )}
                          </>
                        )}
                        {split && campaign.bid !== '0' && (
                          <Metrics
                            items={[
                              [
                                campaign.state === 'bidding'
                                  ? 'Creator at finalization'
                                  : 'Creator released at finalization',
                                dollars(split.creator),
                              ],
                              ['Vault released at finalization', dollars(split.vault)],
                              ['Remaining campaign escrow', dollars(campaign.held)],
                            ]}
                          />
                        )}
                        <p className={styles.muted}>
                          Only held escrow can be refunded. Already released payments stay with the
                          creator and vault.
                        </p>
                        {campaign.state === 'displaying' && (
                          <>
                            <Link
                              className={styles.button}
                              href={`/marketplace/proof/${campaign.id}`}
                            >
                              Proof and settlement ↗
                            </Link>
                            {market.wallet?.toLowerCase() === campaign.bidder?.toLowerCase() &&
                              logo && (
                                <button
                                  disabled={market.busy}
                                  onClick={() =>
                                    void market.run(
                                      'Update only this slot’s ENS artwork',
                                      async () => {
                                        const stored = await client.uploadMedia(
                                          await market.authenticate(),
                                          logo,
                                        );
                                        return client.setSlotArtwork(
                                          market.wallet!,
                                          slot.resolver,
                                          slot.dnsName,
                                          stored.uri,
                                        );
                                      },
                                    )
                                  }
                                >
                                  Update public artwork through ENS
                                </button>
                              )}
                            <p className={styles.muted}>
                              Proof compares the original winning artwork. Updating ENS does not
                              replace that fulfillment target.
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <p>No campaign is open for this slot.</p>
                    )}
                  </>
                )}
              </section>
              {creator &&
                slot &&
                (!campaign || ['completed', 'no-sale', 'refunded'].includes(campaign.state)) && (
                  <CampaignForm slot={slot} asset={asset} />
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
