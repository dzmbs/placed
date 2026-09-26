'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Asset } from '@/lib/marketplace/domain';
import type { Draft } from '@/lib/types';
import { DEFAULT_CAMPAIGN } from '@/lib/studio';
import { api } from '@/lib/marketplace/client';
import { formatUnits } from 'viem';
import { useMarketplace } from './context';
import styles from './marketplace.module.css';
export const Viewer = dynamic(() => import('@/components/viewer'), {
  ssr: false,
  loading: () => <p className={styles.muted}>Loading interactive model…</p>,
});
export const dollars = (raw: string | bigint) =>
  `${Number(formatUnits(BigInt(raw), 6)).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC`;
export const tokens = (raw: string | bigint) =>
  Number(formatUnits(BigInt(raw), 18)).toLocaleString(undefined, { maximumFractionDigits: 6 });
export const time = (value: number) => new Date(value * 1000).toLocaleString();
export function useRecord<T>(path: string | undefined) {
  const { revision } = useMarketplace();
  const [record, setRecord] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!path) {
      setRecord(undefined);
      return;
    }
    let alive = true;
    const load = () =>
      api<T>(path)
        .then((value) => {
          if (alive) {
            setRecord(value);
            setError('');
          }
        })
        .catch((error) => {
          if (alive) setError(error.message);
        });
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [path, revision]);
  return { record, error };
}
export function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now() / 1000);
    const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function assetDraft(asset: Asset): Draft {
  return {
    version: 1,
    asset: asset.metadata?.kind || 'dress',
    assetUrl: asset.metadata?.modelUrl,
    humanPreset: asset.metadata?.humanPreset,
    color: asset.metadata?.color || '#e2d9c9',
    campaign: DEFAULT_CAMPAIGN,
    spots: asset.slots.flatMap((slot) =>
      slot.metadata
        ? [
            {
              ...slot.metadata.placement,
              id: slot.id,
              price: Number(BigInt(slot.campaign?.bid || '0')) / 1e6,
              artwork: slot.publicArtwork,
            },
          ]
        : [],
    ),
  };
}
export function Metrics({ items }: { items: [string, string][] }) {
  return (
    <dl className={styles.metrics}>
      {items.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className={styles.warning} role="alert">
      {error}
    </p>
  ) : null;
}
