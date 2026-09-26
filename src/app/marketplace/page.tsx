'use client';
import Link from 'next/link';
import type { Asset } from '@/lib/marketplace/domain';
import { useRecord, ErrorMessage } from '@/components/marketplace/shared';
import styles from '@/components/marketplace/marketplace.module.css';
export default function Marketplace() {
  const { record: assets, error } = useRecord<Asset[]>('/assets');
  return (
    <>
      <p className={styles.eyebrow}>
        Creators list assets. Brands book slots. Investors buy asset revenue shares.
      </p>
      <h1>Your world has room for a brand.</h1>
      <p className={styles.muted}>
        Book a placement on something real. For repeatable advertising, invest in a share of the
        asset’s collected revenue.
      </p>
      <div className={styles.controls}>
        <Link className={styles.button} href="/marketplace/create">
          List your first asset ↗
        </Link>
        <Link className={styles.button} href="/studio">
          Open the 3D studio
        </Link>
      </div>
      <ErrorMessage error={error} />
      {assets?.length === 0 && (
        <div className={styles.empty}>
          <h2>A fresh marketplace.</h2>
          <p>
            Publish an asset, mark its first slot and open a demo USDC auction. Financing is
            optional.
          </p>
        </div>
      )}
      {!assets && !error && <p>Loading Sepolia assets…</p>}
      <div className={styles.grid}>
        {assets?.map((asset) => (
          <Link className={styles.card} href={`/marketplace/assets/${asset.id}`} key={asset.id}>
            {(asset.metadata?.photos[0] || asset.metadata?.humanPreset) && (
              <img
                src={asset.metadata.photos[0] || `/models/humans/${asset.metadata.humanPreset}.png`}
                alt={asset.metadata.title}
              />
            )}
            <h2>{asset.metadata?.title || `Asset ${asset.id}`}</h2>
            <p>
              {asset.slots.length} independently bookable slots
              {asset.financing ? ' · Revenue-share launch' : ''}
            </p>
            <p className={styles.code}>{asset.ensName}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
